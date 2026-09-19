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


        if (key === name) {

            return values.join("=");
        }
    }


    return null;
}


/* =========================================================
   ADMIN AUTH
========================================================= */

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


/* =========================================================
   MAIN HANDLER
========================================================= */

module.exports =
async function handler(
    req,
    res
) {

    /* =====================================================
       ADMIN SESSION
    ===================================================== */

    if (
        !authorized(req)
    ) {

        return res
            .status(401)
            .json({

                success: false,

                message:
                    "Administrator session expired."

            });
    }


    /* =====================================================
       GET
       EVENT + READINESS + LIVE PROGRESS + RESULTS DATA
    ===================================================== */

    if (
        req.method ===
        "GET"
    ) {

        /* -------------------------------------------------
           EVENT
        ------------------------------------------------- */

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
                    started_at,
                    final_qr_code
                `)
                .eq(
                    "id",
                    1
                )
                .single();


        if (
            eventError ||
            !event
        ) {

            console.error(
                "EVENT LOAD ERROR:",
                eventError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Could not load event."

                });
        }


        /* -------------------------------------------------
           TEAMS
        ------------------------------------------------- */

        const {
            data: teams,
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
                    route_ready,
                    finished_at
                `)
                .order(
                    "id"
                );


        if (
            teamError
        ) {

            console.error(
                "TEAM LOAD ERROR:",
                teamError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Could not load teams."

                });
        }


        /* -------------------------------------------------
           CHECKPOINT SCANS
        ------------------------------------------------- */

        const {
            data: scans,
            error: scanError
        } =
            await supabase
                .from(
                    "checkpoint_scans"
                )
                .select(`
                    team_id,
                    checkpoint_number,
                    scanned_at,
                    hint_revealed_at,
                    answer_revealed_at
                `)
                .order(
                    "scanned_at"
                );


        if (
            scanError
        ) {

            console.error(
                "SCAN LOAD ERROR:",
                scanError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Could not load checkpoint scans."

                });
        }


        /* -------------------------------------------------
           FINAL SCANS
        ------------------------------------------------- */

        const {
            data: finals,
            error: finalError
        } =
            await supabase
                .from(
                    "final_scans"
                )
                .select(`
                    team_id,
                    scanned_at
                `)
                .order(
                    "scanned_at"
                );


        if (
            finalError
        ) {

            console.error(
                "FINAL LOAD ERROR:",
                finalError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Could not load final scans."

                });
        }


        /* =================================================
           BUILD LIVE PROGRESS
        ================================================= */

        const progress =
            (
                teams ||
                []
            )
                .map(
                    team => {

                        const teamScans =
                            (
                                scans ||
                                []
                            )
                                .filter(
                                    scan =>
                                        Number(
                                            scan.team_id
                                        )
                                        ===
                                        Number(
                                            team.id
                                        )
                                )
                                .sort(
                                    (
                                        a,
                                        b
                                    ) =>
                                        Number(
                                            a.checkpoint_number
                                        )
                                        -
                                        Number(
                                            b.checkpoint_number
                                        )
                                );


                        const finalScan =
                            (
                                finals ||
                                []
                            )
                                .find(
                                    scan =>
                                        Number(
                                            scan.team_id
                                        )
                                        ===
                                        Number(
                                            team.id
                                        )
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
                                Number(
                                    team.current_checkpoint
                                )
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


                                default:

                                    currentStageLabel =
                                        "UNKNOWN";
                            }
                        }


                        return {

                            id:
                                team.id,


                            name:
                                team.team_name,


                            cameraReady:
                                Boolean(
                                    team.camera_ready
                                ),


                            routeReady:
                                Boolean(
                                    team.route_ready
                                ),


                            currentStage:
                                Number(
                                    team.current_checkpoint
                                ),


                            currentStageLabel,


                            finishedAt:
                                team.finished_at,


                            scans:
                                teamScans,


                            finalScan:
                                finalScan ||
                                null

                        };
                    }
                );


        /* =================================================
           RESPONSE
        ================================================= */

        return res
            .status(200)
            .json({

                success: true,


                event: {

                    status:
                        event.status,


                    started_at:
                        event.started_at,


                    finalQrConfigured:
                        Boolean(
                            event.final_qr_code
                        )

                },


                /* -----------------------------------------
                   Used by Event Control
                ----------------------------------------- */

                teams:
                    (
                        teams ||
                        []
                    )
                        .map(
                            team => ({

                                id:
                                    team.id,


                                team_name:
                                    team.team_name,


                                camera_ready:
                                    Boolean(
                                        team.camera_ready
                                    ),


                                route_ready:
                                    Boolean(
                                        team.route_ready
                                    )

                            })
                        ),


                /* -----------------------------------------
                   Used by Live Progress + Results
                ----------------------------------------- */

                progress

            });
    }


    /* =====================================================
       POST
       START EVENT
    ===================================================== */

    if (
        req.method ===
        "POST"
    ) {

        /* -------------------------------------------------
           EVENT CONFIG
        ------------------------------------------------- */

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
                    final_qr_code
                `)
                .eq(
                    "id",
                    1
                )
                .single();


        if (
            eventError ||
            !event
        ) {

            console.error(
                "START EVENT CONFIG ERROR:",
                eventError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Could not verify event configuration."

                });
        }


        /* -------------------------------------------------
           MUST BE WAITING
        ------------------------------------------------- */

        if (
            event.status !==
            "waiting"
        ) {

            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        "Reset the event before starting a new hunt."

                });
        }


        /* -------------------------------------------------
           TEAMS
        ------------------------------------------------- */

        const {
            data: teams,
            error: teamError
        } =
            await supabase
                .from(
                    "teams"
                )
                .select(`
                    id,
                    team_name,
                    camera_ready,
                    route_ready
                `)
                .order(
                    "id"
                );


        if (
            teamError
        ) {

            console.error(
                "START TEAM LOAD ERROR:",
                teamError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Could not verify teams."

                });
        }


        /* =================================================
           EXACTLY FOUR TEAMS
        ================================================= */

        if (
            !teams ||
            teams.length !== 4
        ) {

            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        "Exactly four teams must be registered."

                });
        }


        /* =================================================
           ROUTE READINESS
        ================================================= */

        const missingRoutes =
            teams.filter(
                team =>
                    !team.route_ready
            );


        if (
            missingRoutes.length >
            0
        ) {

            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        "Every team must have Start + CP1–CP4 configured.",


                    teams:
                        missingRoutes
                            .map(
                                team =>
                                    team.team_name
                            )

                });
        }


        /* =================================================
           COMMON CP5 QR
        ================================================= */

        if (
            !event.final_qr_code
        ) {

            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        "Configure the common Checkpoint 5 QR before starting."

                });
        }


        /* =================================================
           CAMERA READINESS
        ================================================= */

        const notReady =
            teams.filter(
                team =>
                    !team.camera_ready
            );


        if (
            notReady.length >
            0
        ) {

            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        "All team leaders must complete camera verification.",


                    teams:
                        notReady
                            .map(
                                team =>
                                    team.team_name
                            )

                });
        }


        /* =================================================
           EXTRA SAFETY:
           MAKE SURE EACH TEAM REALLY HAS 5 ROUTE ROWS

           route_ready should already guarantee this,
           but this protects against stale route_ready values.
        ================================================= */

        for (
            const team
            of teams
        ) {

            const {
                data: routes,
                error: routeError
            } =
                await supabase
                    .from(
                        "team_routes"
                    )
                    .select(`
                        checkpoint_number,
                        qr_code,
                        clue
                    `)
                    .eq(
                        "team_id",
                        team.id
                    );


            if (
                routeError
            ) {

                console.error(
                    "ROUTE VERIFY ERROR:",
                    routeError
                );


                return res
                    .status(500)
                    .json({

                        success: false,

                        message:
                            `Could not verify route for ${team.team_name}.`

                    });
            }


            const configuredStages =
                new Set(

                    (
                        routes ||
                        []
                    )
                        .filter(
                            route =>
                                route.qr_code &&
                                route.clue
                        )
                        .map(
                            route =>
                                Number(
                                    route.checkpoint_number
                                )
                        )

                );


            const complete =
                (
                    configuredStages
                        .has(1)
                    &&
                    configuredStages
                        .has(2)
                    &&
                    configuredStages
                        .has(3)
                    &&
                    configuredStages
                        .has(4)
                    &&
                    configuredStages
                        .has(5)
                );


            if (
                !complete
            ) {

                /*
                 * Repair stale route_ready.
                 */

                await supabase
                    .from(
                        "teams"
                    )
                    .update({

                        route_ready:
                            false

                    })
                    .eq(
                        "id",
                        team.id
                    );


                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            `${team.team_name}'s route is incomplete.`,

                        teams: [
                            team.team_name
                        ]

                    });
            }
        }


        /* =================================================
           START EVENT
        ================================================= */

        const startTime =
            new Date()
                .toISOString();


        const {
            error: startError
        } =
            await supabase
                .from(
                    "event_config"
                )
                .update({

                    status:
                        "running",


                    started_at:
                        startTime

                })
                .eq(
                    "id",
                    1
                );


        if (
            startError
        ) {

            console.error(
                "START EVENT ERROR:",
                startError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Could not start event."

                });
        }


        return res
            .status(200)
            .json({

                success: true,

                message:
                    "Treasure Hunt started!",

                startedAt:
                    startTime

            });
    }


    /* =====================================================
       PATCH
       RESET EVENT
    ===================================================== */

    if (
        req.method ===
        "PATCH"
    ) {

        /* =================================================
           RESET EVENT STATUS

           IMPORTANT:
           final_qr_code is NOT removed.
           Route configuration remains saved.
        ================================================= */

        const {
            error: eventResetError
        } =
            await supabase
                .from(
                    "event_config"
                )
                .update({

                    status:
                        "waiting",


                    started_at:
                        null

                })
                .eq(
                    "id",
                    1
                );


        if (
            eventResetError
        ) {

            console.error(
                "EVENT RESET ERROR:",
                eventResetError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Could not reset event."

                });
        }


        /* =================================================
           RESET ALL TEAM EVENT STATE

           IMPORTANT:
           route_ready is intentionally NOT changed.
        ================================================= */

        const {
            error: teamResetError
        } =
            await supabase
                .from(
                    "teams"
                )
                .update({

                    current_checkpoint:
                        1,


                    active_session_token:
                        null,


                    login_time:
                        null,


                    camera_ready:
                        false,


                    ready_at:
                        null,


                    finished_at:
                        null

                })
                .gte(
                    "id",
                    0
                );


        if (
            teamResetError
        ) {

            console.error(
                "TEAM RESET ERROR:",
                teamResetError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Event reset, but team reset failed."

                });
        }


        /* =================================================
           DELETE CHECKPOINT HISTORY

           This also automatically clears:
           - scanned_at
           - hint_revealed_at
           - answer_revealed_at

           because those values live inside
           checkpoint_scans.
        ================================================= */

        const {
            error: checkpointDeleteError
        } =
            await supabase
                .from(
                    "checkpoint_scans"
                )
                .delete()
                .gte(
                    "id",
                    0
                );


        if (
            checkpointDeleteError
        ) {

            console.error(
                "CHECKPOINT RESET ERROR:",
                checkpointDeleteError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Team state was reset, but checkpoint history could not be cleared."

                });
        }


        /* =================================================
           DELETE FINAL RESULTS
        ================================================= */

        const {
            error: finalDeleteError
        } =
            await supabase
                .from(
                    "final_scans"
                )
                .delete()
                .gte(
                    "id",
                    0
                );


        if (
            finalDeleteError
        ) {

            console.error(
                "FINAL RESET ERROR:",
                finalDeleteError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Checkpoint history was reset, but final results could not be cleared."

                });
        }


        /* =================================================
           DELETE WRONG QR ATTEMPTS
        ================================================= */

        const {
            error: attemptsDeleteError
        } =
            await supabase
                .from(
                    "scan_attempts"
                )
                .delete()
                .gte(
                    "id",
                    0
                );


        if (
            attemptsDeleteError
        ) {

            console.error(
                "ATTEMPT RESET ERROR:",
                attemptsDeleteError
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Event reset completed, but scan-attempt history could not be cleared."

                });
        }


        /* =================================================
           SUCCESS
        ================================================= */

        return res
            .status(200)
            .json({

                success: true,

                message:
                    "Event has been reset. Routes, clues, images, hints, answers and the common final QR remain configured."

            });
    }


    /* =====================================================
       METHOD NOT ALLOWED
    ===================================================== */

    return res
        .status(405)
        .json({

            success: false,

            message:
                "Method not allowed."

        });
};