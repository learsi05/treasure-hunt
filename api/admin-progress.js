const { createClient } =
    require("@supabase/supabase-js");

const crypto =
    require("crypto");


const supabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY,
        {
            auth: {
                persistSession: false
            }
        }
    );


function getCookie(req, name) {

    const header =
        req.headers.cookie || "";

    for (const cookie of header.split(";")) {

        const [key, ...values] =
            cookie.trim().split("=");

        if (key === name) {
            return values.join("=");
        }
    }

    return null;
}


function expectedAdminToken() {

    return crypto
        .createHmac(
            "sha256",
            process.env.ADMIN_PASSWORD
        )
        .update(
            "treasure-hunt-admin"
        )
        .digest("hex");
}


function authorized(req) {

    return (
        getCookie(
            req,
            "admin_session"
        )
        ===
        expectedAdminToken()
    );
}


module.exports =
async function handler(req, res) {

    if (!authorized(req)) {

        return res.status(401).json({
            success: false,
            message:
                "Administrator session expired."
        });
    }


    if (req.method !== "GET") {

        return res.status(405).json({
            success: false
        });
    }


    const {
        data: event,
        error: eventError
    } = await supabase
        .from("event_config")
        .select(`
            status,
            started_at
        `)
        .eq("id", 1)
        .single();


    if (eventError) {

        return res.status(500).json({
            success: false,
            message:
                "Could not load event."
        });
    }


    const {
        data: teams,
        error: teamError
    } = await supabase
        .from("teams")
        .select(`
            id,
            team_name,
            current_checkpoint,
            camera_ready,
            finished_at
        `)
        .order("id");


    if (teamError) {

        return res.status(500).json({
            success: false,
            message:
                "Could not load teams."
        });
    }


    const {
        data: scans,
        error: scanError
    } = await supabase
        .from("checkpoint_scans")
        .select(`
            team_id,
            checkpoint_number,
            scanned_at
        `)
        .order("scanned_at");


    if (scanError) {

        return res.status(500).json({
            success: false,
            message:
                "Could not load checkpoint scans."
        });
    }


    const {
        data: finals,
        error: finalError
    } = await supabase
        .from("final_scans")
        .select(`
            team_id,
            scanned_at
        `)
        .order("scanned_at");


    if (finalError) {

        return res.status(500).json({
            success: false,
            message:
                "Could not load final scans."
        });
    }


    const progress =
        teams.map(team => {

            const teamScans =
                scans
                    .filter(
                        scan =>
                            scan.team_id ===
                            team.id
                    )
                    .sort(
                        (a, b) =>
                            a.checkpoint_number -
                            b.checkpoint_number
                    );


            const finalScan =
                finals.find(
                    scan =>
                        scan.team_id ===
                        team.id
                );


            let currentStageLabel =
                "START";


            if (
                team.finished_at
            ) {

                currentStageLabel =
                    "FINISHED";

            } else {

                switch (
                    team.current_checkpoint
                ) {

                    case 1:
                        currentStageLabel =
                            "START";
                        break;

                    case 2:
                        currentStageLabel =
                            "CP1";
                        break;

                    case 3:
                        currentStageLabel =
                            "CP2";
                        break;

                    case 4:
                        currentStageLabel =
                            "CP3";
                        break;

                    case 5:
                        currentStageLabel =
                            "CP4";
                        break;

                    case 6:
                        currentStageLabel =
                            "CP5 FINAL";
                        break;
                }
            }


            return {

                id:
                    team.id,

                name:
                    team.team_name,

                cameraReady:
                    team.camera_ready,

                currentStage:
                    team.current_checkpoint,

                currentStageLabel,

                finishedAt:
                    team.finished_at,

                scans:
                    teamScans,

                finalScan:
                    finalScan || null

            };
        });


    return res.status(200).json({

        success: true,

        event,

        progress
    });
};