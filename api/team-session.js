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


    const cookies =
        header.split(";");


    for (
        const cookie
        of cookies
    ) {

        const [
            key,
            ...parts
        ] =
            cookie
                .trim()
                .split("=");


        if (
            key === name
        ) {

            const value =
                parts.join("=");


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
        "GET"
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


    /*
     * Prevent browsers / proxies
     * from caching session state.
     */

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
                login_time,
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
            "TEAM SESSION ERROR:",
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
            "TEAM SESSION EVENT ERROR:",
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
       RESPONSE
    ===================================================== */

    return res
        .status(200)
        .json({

            success:
                true,


            serverNow:
                new Date()
                    .toISOString(),


            finished:
                Boolean(
                    team.finished_at
                ),


            team: {

                id:
                    team.id,


                name:
                    team.team_name,


                currentCheckpoint:
                    Number(
                        team.current_checkpoint
                    ),


                loginTime:
                    team.login_time ||
                    null,


                cameraReady:
                    Boolean(
                        team.camera_ready
                    ),


                readyAt:
                    team.ready_at ||
                    null,


                finishedAt:
                    team.finished_at ||
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
};