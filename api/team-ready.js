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


/* =========================================================
   COOKIE
========================================================= */

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


        if (
            key === name
        ) {

            const value =
                values.join("=");


            try {

                return decodeURIComponent(
                    value
                );

            } catch (error) {

                return value;
            }
        }
    }


    return null;
}


/* =========================================================
   TOKEN HASH
========================================================= */

function hashToken(
    token
) {

    return crypto
        .createHash(
            "sha256"
        )
        .update(
            token
        )
        .digest(
            "hex"
        );
}


/* =========================================================
   MAIN HANDLER
========================================================= */

module.exports =
async function handler(
    req,
    res
) {

    /* =====================================================
       METHOD
    ===================================================== */

    if (
        req.method !==
        "POST"
    ) {

        return res
            .status(405)
            .json({

                success:
                    false,

                message:
                    "Method not allowed."

            });
    }


    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
    );


    /* =====================================================
       SESSION COOKIE
    ===================================================== */

    const token =
        getCookie(
            req,
            "treasure_session"
        );


    if (!token) {

        return res
            .status(401)
            .json({

                success:
                    false,

                message:
                    "No active team session."

            });
    }


    const tokenHash =
        hashToken(
            token
        );


    /* =====================================================
       TEAM
    ===================================================== */

    const {
        data: team,
        error: teamError
    } =
        await supabase
            .from(
                "teams"
            )
            .select(`
                id,
                team_name,
                current_checkpoint,
                camera_ready,
                ready_at,
                finished_at
            `)
            .eq(
                "active_session_token",
                tokenHash
            )
            .maybeSingle();


    if (
        teamError
    ) {

        console.error(
            "TEAM READY SESSION ERROR:",
            teamError
        );


        return res
            .status(500)
            .json({

                success:
                    false,

                message:
                    "Could not verify team session."

            });
    }


    if (!team) {

        return res
            .status(401)
            .json({

                success:
                    false,

                message:
                    "Invalid or expired team session."

            });
    }


    /* =====================================================
       EVENT
    ===================================================== */

    const {
        data: event,
        error: eventError
    } =
        await supabase
            .from(
                "event_config"
            )
            .select(`
                status,
                started_at
            `)
            .eq(
                "id",
                1
            )
            .maybeSingle();


    if (
        eventError
    ) {

        console.error(
            "TEAM READY EVENT ERROR:",
            eventError
        );


        return res
            .status(500)
            .json({

                success:
                    false,

                message:
                    "Could not verify event status."

            });
    }


    if (!event) {

        return res
            .status(500)
            .json({

                success:
                    false,

                message:
                    "Event configuration was not found."

            });
    }


    /* =====================================================
       EVENT ALREADY FINISHED
    ===================================================== */

    if (
        event.status ===
        "finished"
    ) {

        return res
            .status(409)
            .json({

                success:
                    false,

                code:
                    "EVENT_FINISHED",

                message:
                    "The event has already finished."

            });
    }


    /* =====================================================
       TEAM ALREADY FINISHED
    ===================================================== */

    if (
        team.finished_at
    ) {

        return res
            .status(200)
            .json({

                success:
                    true,

                finished:
                    true,

                message:
                    "Team has already finished.",


                team: {

                    id:
                        team.id,

                    name:
                        team.team_name,

                    currentCheckpoint:
                        Number(
                            team.current_checkpoint
                        )

                },


                event: {

                    status:
                        event.status,

                    startedAt:
                        event.started_at ||
                        null

                }

            });
    }


    /* =====================================================
       ALREADY CAMERA READY
    ===================================================== */

    if (
        team.camera_ready
    ) {

        return res
            .status(200)
            .json({

                success:
                    true,

                alreadyReady:
                    true,

                message:
                    "Team camera is already verified.",


                team: {

                    id:
                        team.id,

                    name:
                        team.team_name,

                    currentCheckpoint:
                        Number(
                            team.current_checkpoint
                        ),

                    cameraReady:
                        true,

                    readyAt:
                        team.ready_at ||
                        null

                },


                event: {

                    status:
                        event.status,

                    startedAt:
                        event.started_at ||
                        null

                }

            });
    }


    /* =====================================================
       MARK CAMERA READY

       IMPORTANT:
       This does NOT modify:
       - current_checkpoint
       - checkpoint scans
       - hint reveal state
       - answer reveal state
       - route progress
    ===================================================== */

    const readyTime =
        new Date()
            .toISOString();


    const {
        data: updatedTeam,
        error: updateError
    } =
        await supabase
            .from(
                "teams"
            )
            .update({

                camera_ready:
                    true,

                ready_at:
                    readyTime

            })
            .eq(
                "id",
                team.id
            )
            .select(`
                id,
                team_name,
                current_checkpoint,
                camera_ready,
                ready_at,
                finished_at
            `)
            .maybeSingle();


    if (
        updateError
    ) {

        console.error(
            "TEAM READY UPDATE ERROR:",
            updateError
        );


        return res
            .status(500)
            .json({

                success:
                    false,

                message:
                    "Could not mark team ready."

            });
    }


    if (!updatedTeam) {

        return res
            .status(401)
            .json({

                success:
                    false,

                message:
                    "Team session is no longer valid."

            });
    }


    /* =====================================================
       SUCCESS
    ===================================================== */

    return res
        .status(200)
        .json({

            success:
                true,

            alreadyReady:
                false,

            message:
                "Camera verified. Team ready.",


            team: {

                id:
                    updatedTeam.id,

                name:
                    updatedTeam.team_name,

                currentCheckpoint:
                    Number(
                        updatedTeam.current_checkpoint
                    ),

                cameraReady:
                    Boolean(
                        updatedTeam.camera_ready
                    ),

                readyAt:
                    updatedTeam.ready_at

            },


            event: {

                status:
                    event.status,

                startedAt:
                    event.started_at ||
                    null

            }

        });
};