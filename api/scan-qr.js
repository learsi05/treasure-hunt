const { createClient } =
    require("@supabase/supabase-js");

const crypto =
    require("crypto");


const supabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
    );


function getCookie(
    req,
    name
) {

    const header =
        req.headers.cookie || "";


    for (
        const cookie
        of header.split(";")
    ) {

        const [
            key,
            ...values
        ] =
            cookie
                .trim()
                .split("=");


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
async function handler(
    req,
    res
) {

    if (
        req.method !== "POST"
    ) {

        return res
            .status(405)
            .json({
                success: false
            });
    }


    const {
        qrCode
    } =
        req.body || {};


    if (!qrCode) {

        return res
            .status(400)
            .json({
                success: false,

                message:
                    "No QR detected."
            });
    }


    const scanned =
        String(qrCode)
            .trim();


    const token =
        getCookie(
            req,
            "treasure_session"
        );


    if (!token) {

        return res
            .status(401)
            .json({
                success: false
            });
    }


    const tokenHash =
        hashToken(token);


    const {
        data: team
    } =
        await supabase
            .from("teams")
            .select(`
                id,
                team_name,
                current_checkpoint,
                finished_at
            `)
            .eq(
                "active_session_token",
                tokenHash
            )
            .maybeSingle();


    if (!team) {

        return res
            .status(401)
            .json({
                success: false
            });
    }


    if (team.finished_at) {

        return res
            .status(400)
            .json({
                success: false,

                message:
                    "This team has already finished."
            });
    }


    const {
        data: event
    } =
        await supabase
            .from(
                "event_config"
            )
            .select(`
                status,
                final_qr_code
            `)
            .eq(
                "id",
                1
            )
            .single();


    if (
        event.status !==
        "running"
    ) {

        return res
            .status(409)
            .json({
                success: false,

                message:
                    "The event is not currently running."
            });
    }


    const stage =
        team.current_checkpoint;


    /* =====================================================
       FINAL COMMON QR
       Stage 6
    ===================================================== */

    if (stage === 6) {

        if (
            scanned !==
            event.final_qr_code
        ) {

            await supabase
                .from(
                    "scan_attempts"
                )
                .insert({
                    team_id:
                        team.id,

                    scanned_qr:
                        scanned,

                    expected_checkpoint:
                        6,

                    result:
                        "WRONG_FINAL_QR"
                });


            return res
                .status(400)
                .json({
                    success: false,

                    code:
                        "WRONG_FINAL_QR",

                    message:
                        "This is not the final treasure QR."
                });
        }


        const finishTime =
            new Date()
                .toISOString();


        await supabase
            .from(
                "final_scans"
            )
            .upsert(
                {
                    team_id:
                        team.id,

                    scanned_at:
                        finishTime
                },
                {
                    onConflict:
                        "team_id"
                }
            );


        await supabase
            .from("teams")
            .update({
                finished_at:
                    finishTime
            })
            .eq(
                "id",
                team.id
            );


        return res
            .status(200)
            .json({

                success: true,

                finished: true,

                finishTime
            });
    }


    /* =====================================================
       PREVENT EARLY FINAL QR
    ===================================================== */

    if (
        event.final_qr_code &&
        scanned ===
        event.final_qr_code
    ) {

        return res
            .status(400)
            .json({

                success: false,

                code:
                    "FINAL_LOCKED",

                message:
                    "The final checkpoint is locked. Complete your route first."
            });
    }


    /* =====================================================
       EXPECTED TEAM-SPECIFIC QR
    ===================================================== */

    const {
        data: expected
    } =
        await supabase
            .from(
                "team_routes"
            )
            .select(`
                qr_code,
                clue,
                checkpoint_number
            `)
            .eq(
                "team_id",
                team.id
            )
            .eq(
                "checkpoint_number",
                stage
            )
            .single();


    if (!expected) {

        return res
            .status(500)
            .json({
                success: false,

                message:
                    "This stage has not been configured."
            });
    }


    /* =====================================================
       CORRECT QR
    ===================================================== */

    if (
        scanned ===
        expected.qr_code
    ) {

        const scanTime =
            new Date()
                .toISOString();


        const {
            error: scanError
        } =
            await supabase
                .from(
                    "checkpoint_scans"
                )
                .upsert(
                    {
                        team_id:
                            team.id,

                        checkpoint_number:
                            stage,

                        qr_code:
                            scanned,

                        scanned_at:
                            scanTime
                    },
                    {
                        onConflict:
                            "team_id,checkpoint_number"
                    }
                );


        if (scanError) {

            return res
                .status(500)
                .json({
                    success: false,

                    message:
                        "Could not record checkpoint."
                });
        }


        const nextStage =
            stage + 1;


        await supabase
            .from("teams")
            .update({
                current_checkpoint:
                    nextStage
            })
            .eq(
                "id",
                team.id
            );


        let completedLabel;


        if (stage === 1) {

            completedLabel =
                "Starting QR";

        } else {

            completedLabel =
                `Checkpoint ${stage - 1}`;
        }


        return res
            .status(200)
            .json({

                success: true,

                finished: false,

                completedStage:
                    stage,

                completedLabel,

                nextStage,

                revealedClue:
                    expected.clue,

                finalStage:
                    nextStage === 6
            });
    }


    /* =====================================================
       WRONG QR CLASSIFICATION
    ===================================================== */

    const {
        data: qrOwner
    } =
        await supabase
            .from(
                "team_routes"
            )
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
        "This QR is not part of your current path.";


    if (qrOwner) {

        if (
            qrOwner.team_id !==
            team.id
        ) {

            resultCode =
                "WRONG_TEAM";


            message =
                "This QR belongs to another team.";
        }

        else if (
            qrOwner.checkpoint_number >
            stage
        ) {

            resultCode =
                "FUTURE_CHECKPOINT";


            message =
                "You found a future checkpoint. Complete your current stage first.";
        }

        else {

            resultCode =
                "OLD_CHECKPOINT";


            message =
                "You have already completed this QR.";
        }
    }


    await supabase
        .from(
            "scan_attempts"
        )
        .insert({

            team_id:
                team.id,

            scanned_qr:
                scanned,

            expected_checkpoint:
                stage,

            result:
                resultCode
        });


    return res
        .status(400)
        .json({

            success: false,

            code:
                resultCode,

            message
        });
};