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

            return values.join("=");
        }
    }


    return null;
}


/* =========================================================
   ADMIN AUTH
========================================================= */

function adminToken() {

    return crypto
        .createHmac(
            "sha256",
            process.env.ADMIN_PASSWORD
        )
        .update(
            "treasure-hunt-admin"
        )
        .digest(
            "hex"
        );
}


function authorized(
    req
) {

    return (
        getCookie(
            req,
            "admin_session"
        )
        ===
        adminToken()
    );
}


/* =========================================================
   EVENT STATUS
========================================================= */

async function getEventStatus() {

    const {
        data,
        error
    } =
        await supabase
            .from(
                "event_config"
            )
            .select(
                "status"
            )
            .eq(
                "id",
                1
            )
            .maybeSingle();


    if (
        error ||
        !data
    ) {

        return {
            error:
                error ||
                new Error(
                    "Event configuration not found."
                )
        };
    }


    return {
        status:
            data.status
    };
}


/* =========================================================
   MAIN HANDLER
========================================================= */

module.exports =
async function handler(
    req,
    res
) {

    if (
        !authorized(req)
    ) {

        return res
            .status(401)
            .json({

                success:
                    false,

                message:
                    "Administrator session expired."

            });
    }


    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
    );


    /* =====================================================
       GET TEAMS
    ===================================================== */

    if (
        req.method ===
        "GET"
    ) {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "teams"
                )
                .select(`
                    id,
                    team_name,
                    login_code,
                    current_checkpoint,
                    active_session_token,
                    login_time,
                    camera_ready,
                    ready_at,
                    route_ready,
                    finished_at
                `)
                .order(
                    "id"
                );


        if (
            error
        ) {

            console.error(
                "LOAD TEAMS ERROR:",
                error
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not load teams."

                });
        }


        return res
            .status(200)
            .json({

                success:
                    true,

                teams:
                    data || []

            });
    }


    /* =====================================================
       CREATE TEAM
    ===================================================== */

    if (
        req.method ===
        "POST"
    ) {

        const eventState =
            await getEventStatus();


        if (
            eventState.error
        ) {

            console.error(
                "CREATE TEAM EVENT CHECK ERROR:",
                eventState.error
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


        if (
            eventState.status !==
            "waiting"
        ) {

            return res
                .status(409)
                .json({

                    success:
                        false,

                    message:
                        "Teams can only be added while the event is waiting."

                });
        }


        const {
            teamName,
            loginCode
        } =
            req.body || {};


        const cleanTeamName =
            String(
                teamName ||
                ""
            )
                .trim();


        const cleanLoginCode =
            String(
                loginCode ||
                ""
            )
                .trim()
                .toUpperCase();


        if (
            !cleanTeamName ||
            !cleanLoginCode
        ) {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    message:
                        "Enter both team name and login code."

                });
        }


        const {
            count,
            error: countError
        } =
            await supabase
                .from(
                    "teams"
                )
                .select(
                    "*",
                    {
                        count:
                            "exact",

                        head:
                            true
                    }
                );


        if (
            countError
        ) {

            console.error(
                "TEAM COUNT ERROR:",
                countError
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not verify team slots."

                });
        }


        if (
            Number(count) >= 4
        ) {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    message:
                        "All four team slots are already registered."

                });
        }


        const {
            data,
            error
        } =
            await supabase
                .from(
                    "teams"
                )
                .insert([
                    {

                        team_name:
                            cleanTeamName,

                        login_code:
                            cleanLoginCode,

                        current_checkpoint:
                            1,

                        camera_ready:
                            false,

                        route_ready:
                            false

                    }
                ])
                .select()
                .single();


        if (
            error
        ) {

            console.error(
                "CREATE TEAM ERROR:",
                error
            );


            if (
                error.code ===
                "23505"
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "That team name or login code is already in use."

                    });
            }


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not register team."

                });
        }


        return res
            .status(201)
            .json({

                success:
                    true,

                team:
                    data

            });
    }


    /* =====================================================
       DELETE TEAM
    ===================================================== */

    if (
        req.method ===
        "DELETE"
    ) {

        const eventState =
            await getEventStatus();


        if (
            eventState.error
        ) {

            console.error(
                "DELETE TEAM EVENT CHECK ERROR:",
                eventState.error
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


        if (
            eventState.status !==
            "waiting"
        ) {

            return res
                .status(409)
                .json({

                    success:
                        false,

                    message:
                        "Teams can only be deleted while the event is waiting."

                });
        }


        const {
            teamId
        } =
            req.body || {};


        const id =
            Number(
                teamId
            );


        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    message:
                        "Invalid team."

                });
        }


        const {
            data: existingTeam,
            error: lookupError
        } =
            await supabase
                .from(
                    "teams"
                )
                .select(
                    "id, team_name"
                )
                .eq(
                    "id",
                    id
                )
                .maybeSingle();


        if (
            lookupError
        ) {

            console.error(
                "DELETE TEAM LOOKUP ERROR:",
                lookupError
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not verify team."

                });
        }


        if (
            !existingTeam
        ) {

            return res
                .status(404)
                .json({

                    success:
                        false,

                    message:
                        "Team was not found."

                });
        }


        const {
            error
        } =
            await supabase
                .from(
                    "teams"
                )
                .delete()
                .eq(
                    "id",
                    id
                );


        if (
            error
        ) {

            console.error(
                "DELETE TEAM ERROR:",
                error
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not delete team."

                });
        }


        return res
            .status(200)
            .json({

                success:
                    true,

                message:
                    `${existingTeam.team_name} deleted.`

            });
    }


    /* =====================================================
       RESET LOGIN SESSION
    ===================================================== */

    if (
        req.method ===
        "PATCH"
    ) {

        const {
            teamId
        } =
            req.body || {};


        const id =
            Number(
                teamId
            );


        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    message:
                        "Invalid team."

                });
        }


        const {
            data: updatedTeam,
            error
        } =
            await supabase
                .from(
                    "teams"
                )
                .update({

                    active_session_token:
                        null,

                    login_time:
                        null,

                    camera_ready:
                        false,

                    ready_at:
                        null

                })
                .eq(
                    "id",
                    id
                )
                .select(
                    "id"
                )
                .maybeSingle();


        if (
            error
        ) {

            console.error(
                "RESET TEAM SESSION ERROR:",
                error
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not reset team login session."

                });
        }


        if (
            !updatedTeam
        ) {

            return res
                .status(404)
                .json({

                    success:
                        false,

                    message:
                        "Team was not found."

                });
        }


        return res
            .status(200)
            .json({

                success:
                    true,

                message:
                    "Team login session reset. Progress was preserved."

            });
    }


    /* =====================================================
       METHOD NOT ALLOWED
    ===================================================== */

    return res
        .status(405)
        .json({

            success:
                false,

            message:
                "Method not allowed."

        });
};