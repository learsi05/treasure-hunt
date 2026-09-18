const { createClient } =
    require("@supabase/supabase-js");

const crypto =
    require("crypto");


const supabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
    );


function getCookie(req, name) {

    const header =
        req.headers.cookie || "";

    for (const cookie of header.split(";")) {

        const [
            key,
            ...values
        ] =
            cookie.trim().split("=");

        if (key === name) {

            return decodeURIComponent(
                values.join("=")
            );
        }
    }

    return null;
}


function hashToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


module.exports =
async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            success: false
        });
    }


    const {
        qrCode
    } = req.body || {};


    if (!qrCode) {

        return res.status(400).json({
            success: false
        });
    }


    const token =
        getCookie(
            req,
            "treasure_session"
        );


    if (!token) {

        return res.status(401).json({
            success: false
        });
    }


    const hash =
        hashToken(token);


    const {
        data: team
    } = await supabase
        .from("teams")
        .select(`
            id,
            team_name,
            current_checkpoint
        `)
        .eq(
            "active_session_token",
            hash
        )
        .maybeSingle();


    if (!team) {

        return res.status(401).json({
            success: false
        });
    }


    const {
        data: event
    } = await supabase
        .from("event_config")
        .select("status")
        .eq("id", 1)
        .single();


    if (
        event.status !==
        "running"
    ) {

        return res.status(409).json({
            success: false,
            code:
                "EVENT_NOT_RUNNING",

            message:
                "The event is not currently running."
        });
    }


    if (
        team.current_checkpoint > 5
    ) {

        return res.status(400).json({
            success: false,
            code:
                "CHECKPOINTS_COMPLETE",

            message:
                "All five checkpoints are already complete."
        });
    }


    const {
        data: expected
    } = await supabase
        .from("team_routes")
        .select(`
            qr_code,
            checkpoint_number
        `)
        .eq(
            "team_id",
            team.id
        )
        .eq(
            "checkpoint_number",
            team.current_checkpoint
        )
        .single();


    if (!expected) {

        return res.status(500).json({
            success: false,

            message:
                "Checkpoint has not been configured."
        });
    }


    const scanned =
        String(qrCode)
            .trim();


    // ---------------------------------
    // CORRECT QR
    // ---------------------------------

    if (
        scanned ===
        expected.qr_code
    ) {

        const completed =
            team.current_checkpoint;


        const {
            error: scanError
        } = await supabase
            .from(
                "checkpoint_scans"
            )
            .upsert(
                {
                    team_id:
                        team.id,

                    checkpoint_number:
                        completed,

                    qr_code:
                        scanned,

                    scanned_at:
                        new Date()
                            .toISOString()
                },
                {
                    onConflict:
                        "team_id,checkpoint_number"
                }
            );


        if (scanError) {

            return res.status(500).json({
                success: false,

                message:
                    "Could not record checkpoint."
            });
        }


        const nextCheckpoint =
            completed + 1;


        await supabase
            .from("teams")
            .update({
                current_checkpoint:
                    nextCheckpoint
            })
            .eq(
                "id",
                team.id
            );


        if (
            nextCheckpoint <= 5
        ) {

            const {
                data: nextRoute
            } = await supabase
                .from("team_routes")
                .select("clue")
                .eq(
                    "team_id",
                    team.id
                )
                .eq(
                    "checkpoint_number",
                    nextCheckpoint
                )
                .single();


            return res.status(200).json({

                success: true,

                completedCheckpoint:
                    completed,

                nextCheckpoint,

                nextClue:
                    nextRoute.clue,

                finalStage:
                    false
            });
        }


        return res.status(200).json({

            success: true,

            completedCheckpoint:
                completed,

            nextCheckpoint: 6,

            nextClue:
                "All five checkpoints completed. The final hunt awaits.",

            finalStage:
                true
        });
    }


    // ---------------------------------
    // FIND WHO THIS QR BELONGS TO
    // ---------------------------------

    const {
        data: qrOwner
    } = await supabase
        .from("team_routes")
        .select(`
            team_id,
            checkpoint_number
        `)
        .eq(
            "qr_code",
            scanned
        )
        .maybeSingle();


    let resultCode =
        "UNKNOWN_QR";


    let message =
        "This mark is not part of your current path.";


    if (qrOwner) {

        if (
            qrOwner.team_id !==
            team.id
        ) {

            resultCode =
                "WRONG_TEAM";

            message =
                "This checkpoint belongs to another team's path.";
        }

        else if (
            qrOwner.checkpoint_number >
            team.current_checkpoint
        ) {

            resultCode =
                "FUTURE_CHECKPOINT";

            message =
                "You have discovered a future checkpoint. Complete your current checkpoint first.";
        }

        else {

            resultCode =
                "OLD_CHECKPOINT";

            message =
                "You have already completed this checkpoint.";
        }
    }


    await supabase
        .from("scan_attempts")
        .insert({
            team_id:
                team.id,

            scanned_qr:
                scanned,

            expected_checkpoint:
                team.current_checkpoint,

            result:
                resultCode
        });


    return res.status(400).json({

        success: false,

        code:
            resultCode,

        message
    });
};