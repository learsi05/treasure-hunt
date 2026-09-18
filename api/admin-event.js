const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabase = createClient(
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

        const [
            key,
            ...values
        ] = cookie.trim().split("=");

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

module.exports = async function handler(req, res) {

    if (!authorized(req)) {

        return res.status(401).json({
            success: false,
            message:
                "Administrator session expired."
        });
    }

    // --------------------------
    // GET EVENT STATUS
    // --------------------------

    /* =========================================
   GET EVENT STATUS + READINESS + PROGRESS
========================================= */

if (req.method === "GET") {

    // ---------------------------------
    // EVENT
    // ---------------------------------

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

        console.error(
            "EVENT LOAD ERROR:",
            eventError
        );

        return res.status(500).json({
            success: false,
            message:
                "Could not load event."
        });
    }


    // ---------------------------------
    // TEAMS
    // ---------------------------------

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

        console.error(
            "TEAM LOAD ERROR:",
            teamError
        );

        return res.status(500).json({
            success: false,
            message:
                "Could not load teams."
        });
    }


    // ---------------------------------
    // CHECKPOINT SCANS
    // ---------------------------------

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

        console.error(
            "SCAN LOAD ERROR:",
            scanError
        );

        return res.status(500).json({
            success: false,
            message:
                "Could not load checkpoint scans."
        });
    }


    // ---------------------------------
    // FINAL SCANS
    // ---------------------------------

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

        console.error(
            "FINAL LOAD ERROR:",
            finalError
        );

        return res.status(500).json({
            success: false,
            message:
                "Could not load final scans."
        });
    }


    // ---------------------------------
    // BUILD LIVE PROGRESS
    // ---------------------------------

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


            if (team.finished_at) {

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


    // ---------------------------------
    // RESPONSE
    // ---------------------------------

    return res.status(200).json({

        success: true,

        event,

        // Used by Event Control readiness
        teams:
            teams.map(team => ({
                id:
                    team.id,

                team_name:
                    team.team_name,

                camera_ready:
                    team.camera_ready
            })),

        // Used by Live Progress
        progress
    });
}

    // --------------------------
    // START EVENT
    // --------------------------

    if (req.method === "POST") {

        const {
            data: event
        } = await supabase
            .from("event_config")
            .select("status")
            .eq("id", 1)
            .single();

        if (
            event &&
            event.status === "running"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "The event has already started."
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
                camera_ready
            `);

        if (teamError) {

            return res.status(500).json({
                success: false,
                message:
                    "Could not check team readiness."
            });
        }

        if (teams.length !== 4) {

            return res.status(400).json({
                success: false,
                message:
                    "Exactly 4 teams must be registered before starting."
            });
        }

        const notReady =
            teams.filter(
                team =>
                    !team.camera_ready
            );

        if (notReady.length > 0) {

            return res.status(400).json({
                success: false,

                message:
                    "All four teams must complete the camera check before the event can start.",

                notReady:
                    notReady.map(
                        team =>
                            team.team_name
                    )
            });
        }

        const startTime =
            new Date().toISOString();

        const {
            error: startError
        } = await supabase
            .from("event_config")
            .update({
                status: "running",
                started_at: startTime
            })
            .eq("id", 1);

        if (startError) {

            return res.status(500).json({
                success: false,
                message:
                    "Could not start event."
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Treasure Hunt started!",
            startedAt:
                startTime
        });
    }

    // ==========================================
// RESET EVENT
// ==========================================

if (req.method === "PATCH") {

    // Reset main event state
    const {
        error: eventResetError
    } = await supabase
        .from("event_config")
        .update({
            status: "waiting",
            started_at: null
        })
        .eq("id", 1);


    if (eventResetError) {

        console.error(
            "EVENT RESET ERROR:",
            eventResetError
        );

        return res.status(500).json({
            success: false,
            message:
                "Could not reset event."
        });
    }


    // Reset team state
    const {
        error: teamResetError
    } = await supabase
        .from("teams")
        .update({
            current_checkpoint: 1,

            active_session_token: null,

            login_time: null,

            camera_ready: false,

            ready_at: null,

            finished_at: null
        })
        .gte("id", 0);


    if (teamResetError) {

        console.error(
            "TEAM RESET ERROR:",
            teamResetError
        );

        return res.status(500).json({
            success: false,
            message:
                "Event reset, but team reset failed."
        });
    }


    // Delete checkpoint history
    await supabase
        .from("checkpoint_scans")
        .delete()
        .gte("id", 0);


    // Delete final results
    await supabase
        .from("final_scans")
        .delete()
        .gte("id", 0);


    // Delete failed / wrong QR attempts
    await supabase
        .from("scan_attempts")
        .delete()
        .gte("id", 0);


    return res.status(200).json({
        success: true,
        message:
            "Event has been reset."
    });
}

    return res.status(405).json({
        success: false
    });
};