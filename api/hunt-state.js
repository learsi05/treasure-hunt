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


const HINT_DELAY_MS =
    5 * 60 * 1000;


const ANSWER_DELAY_MS =
    10 * 60 * 1000;


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

            return decodeURIComponent(
                values.join("=")
            );
        }
    }


    return null;
}


/* =========================================================
   TOKEN HASH
========================================================= */

function hashToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


/* =========================================================
   TIME HELPER
========================================================= */

function secondsRemaining(
    unlockAtMs,
    nowMs
) {

    return Math.max(

        0,

        Math.ceil(
            (
                unlockAtMs -
                nowMs
            ) /
            1000
        )

    );
}


/* =========================================================
   BUILD HINT / ANSWER STATE
========================================================= */

function buildAssistanceState(
    route,
    scan,
    nowMs
) {

    const hasHint =
        Boolean(
            route &&
            typeof route.hint ===
                "string" &&
            route.hint.trim()
        );


    /*
     * Answer is meaningful only
     * when a Hint also exists.
     */

    const hasAnswer =
        Boolean(
            hasHint &&
            route &&
            typeof route.answer ===
                "string" &&
            route.answer.trim()
        );


    /*
     * The clue becomes available
     * when the previous QR was
     * successfully scanned.
     */

    const clueAvailableAt =
        scan?.scanned_at ||
        null;


    /* =========================
       HINT
    ========================= */

    let hintUnlockAt =
        null;


    let hintRemainingSeconds =
        null;


    let hintUnlocked =
        false;


    let hintRevealed =
        false;


    let hintText =
        null;


    if (
        hasHint &&
        clueAvailableAt
    ) {

        const clueAvailableMs =
            new Date(
                clueAvailableAt
            )
                .getTime();


        const hintUnlockMs =
            clueAvailableMs +
            HINT_DELAY_MS;


        hintUnlockAt =
            new Date(
                hintUnlockMs
            )
                .toISOString();


        hintRemainingSeconds =
            secondsRemaining(
                hintUnlockMs,
                nowMs
            );


        hintUnlocked =
            nowMs >=
            hintUnlockMs;


        hintRevealed =
            Boolean(
                scan
                    ?.hint_revealed_at
            );


        /*
         * Do not send the Hint
         * text to the browser
         * until the team has
         * actually revealed it.
         */

        if (hintRevealed) {

            hintText =
                route.hint;
        }
    }


    /* =========================
       ANSWER
    ========================= */

    let answerUnlockAt =
        null;


    let answerRemainingSeconds =
        null;


    let answerUnlocked =
        false;


    let answerRevealed =
        false;


    let answerText =
        null;


    /*
     * The 10-minute Answer timer
     * starts only AFTER the team
     * reveals the Hint.
     */

    if (
        hasAnswer &&
        scan?.hint_revealed_at
    ) {

        const hintRevealedMs =
            new Date(
                scan
                    .hint_revealed_at
            )
                .getTime();


        const answerUnlockMs =
            hintRevealedMs +
            ANSWER_DELAY_MS;


        answerUnlockAt =
            new Date(
                answerUnlockMs
            )
                .toISOString();


        answerRemainingSeconds =
            secondsRemaining(
                answerUnlockMs,
                nowMs
            );


        answerUnlocked =
            nowMs >=
            answerUnlockMs;


        answerRevealed =
            Boolean(
                scan
                    ?.answer_revealed_at
            );


        /*
         * Same protection:
         * do not send the Answer
         * until it has been
         * officially revealed.
         */

        if (answerRevealed) {

            answerText =
                route.answer;
        }
    }


    return {

        clueAvailableAt,


        hasHint,

        hintUnlockAt,

        hintRemainingSeconds,

        hintUnlocked,

        hintRevealed,

        hintRevealedAt:
            scan
                ?.hint_revealed_at ||
            null,

        hintText,


        hasAnswer,

        answerUnlockAt,

        answerRemainingSeconds,

        answerUnlocked,

        answerRevealed,

        answerRevealedAt:
            scan
                ?.answer_revealed_at ||
            null,

        answerText

    };
}


/* =========================================================
   LOAD TEAM + EVENT
========================================================= */

async function loadSessionContext(
    req
) {

    const token =
        getCookie(
            req,
            "treasure_session"
        );


    if (!token) {

        return {

            error: {

                status:
                    401,

                body: {

                    success:
                        false,

                    message:
                        "Team session not found."

                }

            }

        };
    }


    const tokenHash =
        hashToken(
            token
        );


    const {
        data: team,
        error: teamError
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


    if (teamError) {

        console.error(
            "HUNT TEAM LOAD ERROR:",
            teamError
        );


        return {

            error: {

                status:
                    500,

                body: {

                    success:
                        false,

                    message:
                        "Could not load team session."

                }

            }

        };
    }


    if (!team) {

        return {

            error: {

                status:
                    401,

                body: {

                    success:
                        false,

                    message:
                        "Team session expired."

                }

            }

        };
    }


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
            .single();


    if (eventError) {

        console.error(
            "HUNT EVENT LOAD ERROR:",
            eventError
        );


        return {

            error: {

                status:
                    500,

                body: {

                    success:
                        false,

                    message:
                        "Could not load event state."

                }

            }

        };
    }


    return {

        team,

        event

    };
}


/* =========================================================
   LOAD CURRENT CLUE
========================================================= */

async function loadCurrentClueContext(
    team
) {

    const stage =
        Number(
            team
                .current_checkpoint
        );


    /*
     * Stage 1 is the Starting
     * Challenge, so no previous
     * QR has been scanned yet.
     */

    if (
        stage <= 1
    ) {

        return {

            stage,

            previousStage:
                null,

            route:
                null,

            scan:
                null

        };
    }


    const previousStage =
        stage - 1;


    /* -------------------------
       ROUTE DATA
    ------------------------- */

    const {
        data: route,
        error: routeError
    } =
        await supabase
            .from(
                "team_routes"
            )
            .select(`
                checkpoint_number,
                clue,
                clue_image_url,
                hint,
                answer
            `)
            .eq(
                "team_id",
                team.id
            )
            .eq(
                "checkpoint_number",
                previousStage
            )
            .maybeSingle();


    if (routeError) {

        console.error(
            "HUNT ROUTE LOAD ERROR:",
            routeError
        );


        return {

            error: {

                status:
                    500,

                body: {

                    success:
                        false,

                    message:
                        "Could not load this clue."

                }

            }

        };
    }


    if (!route) {

        return {

            error: {

                status:
                    500,

                body: {

                    success:
                        false,

                    message:
                        "Route is not configured correctly."

                }

            }

        };
    }


    /* -------------------------
       TIMING DATA
    ------------------------- */

    const {
        data: scan,
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
            .eq(
                "team_id",
                team.id
            )
            .eq(
                "checkpoint_number",
                previousStage
            )
            .maybeSingle();


    if (scanError) {

        console.error(
            "HUNT SCAN LOAD ERROR:",
            scanError
        );


        return {

            error: {

                status:
                    500,

                body: {

                    success:
                        false,

                    message:
                        "Could not load clue timing."

                }

            }

        };
    }


    if (!scan) {

        return {

            error: {

                status:
                    500,

                body: {

                    success:
                        false,

                    message:
                        "Clue timing record is missing."

                }

            }

        };
    }


    return {

        stage,

        previousStage,

        route,

        scan

    };
}


/* =========================================================
   REVEAL HINT
========================================================= */

async function handleRevealHint(
    team
) {

    const clueContext =
        await loadCurrentClueContext(
            team
        );


    if (
        clueContext.error
    ) {

        return clueContext.error;
    }


    const {

        previousStage,

        route,

        scan

    } =
        clueContext;


    if (
        !route
            ?.hint
            ?.trim()
    ) {

        return {

            status:
                400,

            body: {

                success:
                    false,

                message:
                    "No hint is configured for this clue."

            }

        };
    }


    const nowMs =
        Date.now();


    const clueAvailableMs =
        new Date(
            scan.scanned_at
        )
            .getTime();


    const unlockMs =
        clueAvailableMs +
        HINT_DELAY_MS;


    /*
     * Server enforces the
     * 5-minute lock.
     */

    if (
        nowMs <
        unlockMs
    ) {

        return {

            status:
                423,

            body: {

                success:
                    false,

                code:
                    "HINT_LOCKED",

                message:
                    "Hint is still locked.",

                remainingSeconds:
                    secondsRemaining(
                        unlockMs,
                        nowMs
                    ),

                unlockAt:
                    new Date(
                        unlockMs
                    )
                        .toISOString()

            }

        };
    }


    let revealedAt =
        scan
            .hint_revealed_at;


    /*
     * First time the team presses
     * VIEW HINT, store the server
     * timestamp. This starts the
     * Answer timer.
     */

    if (!revealedAt) {

        revealedAt =
            new Date()
                .toISOString();


        const {
            error: updateError
        } =
            await supabase
                .from(
                    "checkpoint_scans"
                )
                .update({

                    hint_revealed_at:
                        revealedAt

                })
                .eq(
                    "team_id",
                    team.id
                )
                .eq(
                    "checkpoint_number",
                    previousStage
                );


        if (updateError) {

            console.error(
                "HINT REVEAL ERROR:",
                updateError
            );


            return {

                status:
                    500,

                body: {

                    success:
                        false,

                    message:
                        "Could not reveal hint."

                }

            };
        }
    }


    const answerUnlockAt =
        route
            ?.answer
            ?.trim()
            ?
            new Date(

                new Date(
                    revealedAt
                )
                    .getTime()

                +

                ANSWER_DELAY_MS

            )
                .toISOString()
            :
            null;


    return {

        status:
            200,

        body: {

            success:
                true,

            action:
                "reveal_hint",

            hint:
                route.hint,

            hintRevealedAt:
                revealedAt,

            hasAnswer:
                Boolean(
                    route
                        ?.answer
                        ?.trim()
                ),

            answerUnlockAt,

            answerRemainingSeconds:
                answerUnlockAt
                    ?
                    secondsRemaining(

                        new Date(
                            answerUnlockAt
                        )
                            .getTime(),

                        Date.now()

                    )
                    :
                    null

        }

    };
}


/* =========================================================
   REVEAL ANSWER
========================================================= */

async function handleRevealAnswer(
    team
) {

    const clueContext =
        await loadCurrentClueContext(
            team
        );


    if (
        clueContext.error
    ) {

        return clueContext.error;
    }


    const {

        previousStage,

        route,

        scan

    } =
        clueContext;


    if (
        !route
            ?.hint
            ?.trim()
    ) {

        return {

            status:
                400,

            body: {

                success:
                    false,

                message:
                    "No hint is configured for this clue."

            }

        };
    }


    if (
        !route
            ?.answer
            ?.trim()
    ) {

        return {

            status:
                400,

            body: {

                success:
                    false,

                message:
                    "No answer is configured for this clue."

            }

        };
    }


    /*
     * Answer cannot begin its timer
     * until Hint has actually been
     * opened by the team.
     */

    if (
        !scan
            .hint_revealed_at
    ) {

        return {

            status:
                423,

            body: {

                success:
                    false,

                code:
                    "HINT_NOT_REVEALED",

                message:
                    "Reveal the hint first."

            }

        };
    }


    const nowMs =
        Date.now();


    const answerUnlockMs =

        new Date(
            scan
                .hint_revealed_at
        )
            .getTime()

        +

        ANSWER_DELAY_MS;


    /*
     * Server enforces the
     * 10-minute lock.
     */

    if (
        nowMs <
        answerUnlockMs
    ) {

        return {

            status:
                423,

            body: {

                success:
                    false,

                code:
                    "ANSWER_LOCKED",

                message:
                    "Answer is still locked.",

                remainingSeconds:
                    secondsRemaining(
                        answerUnlockMs,
                        nowMs
                    ),

                unlockAt:
                    new Date(
                        answerUnlockMs
                    )
                        .toISOString()

            }

        };
    }


    let revealedAt =
        scan
            .answer_revealed_at;


    if (!revealedAt) {

        revealedAt =
            new Date()
                .toISOString();


        const {
            error: updateError
        } =
            await supabase
                .from(
                    "checkpoint_scans"
                )
                .update({

                    answer_revealed_at:
                        revealedAt

                })
                .eq(
                    "team_id",
                    team.id
                )
                .eq(
                    "checkpoint_number",
                    previousStage
                );


        if (updateError) {

            console.error(
                "ANSWER REVEAL ERROR:",
                updateError
            );


            return {

                status:
                    500,

                body: {

                    success:
                        false,

                    message:
                        "Could not reveal answer."

                }

            };
        }
    }


    return {

        status:
            200,

        body: {

            success:
                true,

            action:
                "reveal_answer",

            answer:
                route.answer,

            answerRevealedAt:
                revealedAt

        }

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

    const sessionContext =
        await loadSessionContext(
            req
        );


    if (
        sessionContext.error
    ) {

        return res
            .status(
                sessionContext
                    .error
                    .status
            )
            .json(
                sessionContext
                    .error
                    .body
            );
    }


    const {

        team,

        event

    } =
        sessionContext;


    /* =====================================================
       FINISHED TEAM
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

                team: {

                    name:
                        team.team_name

                },

                event: {

                    status:
                        event.status,

                    startedAt:
                        event.started_at

                },

                serverNow:
                    new Date()
                        .toISOString()

            });
    }


    /* =====================================================
       EVENT MUST BE RUNNING
    ===================================================== */

    if (
        event.status !==
        "running"
    ) {

        return res
            .status(409)
            .json({

                success:
                    false,

                eventStatus:
                    event.status,

                message:
                    "The event is not currently running."

            });
    }


    /* =====================================================
       POST ACTIONS
    ===================================================== */

    if (
        req.method ===
        "POST"
    ) {

        const {
            action
        } =
            req.body || {};


        if (
            action ===
            "reveal_hint"
        ) {

            const result =
                await handleRevealHint(
                    team
                );


            return res
                .status(
                    result.status
                )
                .json(
                    result.body
                );
        }


        if (
            action ===
            "reveal_answer"
        ) {

            const result =
                await handleRevealAnswer(
                    team
                );


            return res
                .status(
                    result.status
                )
                .json(
                    result.body
                );
        }


        return res
            .status(400)
            .json({

                success:
                    false,

                message:
                    "Unknown hunt action."

            });
    }


    /* =====================================================
       ONLY GET BEYOND THIS POINT
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


    const stage =
        Number(
            team
                .current_checkpoint
        );


    const serverNow =
        new Date()
            .toISOString();


    /* =====================================================
       START STAGE
    ===================================================== */

    if (
        stage === 1
    ) {

        return res
            .status(200)
            .json({

                success:
                    true,

                finished:
                    false,

                serverNow,


                team: {

                    name:
                        team.team_name,

                    currentStage:
                        1

                },


                stageLabel:
                    "START",


                clueTitle:
                    "Starting Challenge",


                clue:
                    "Find the QR assigned to your team somewhere in this room.",


                clueImage:
                    null,


                scanButton:
                    "Scan Starting QR",


                finalStage:
                    false,


                /*
                 * No Hint / Answer
                 * for the initial
                 * starting-room task.
                 */

                assistance: {

                    clueAvailableAt:
                        event
                            .started_at ||
                        null,


                    hasHint:
                        false,


                    hintUnlockAt:
                        null,


                    hintRemainingSeconds:
                        null,


                    hintUnlocked:
                        false,


                    hintRevealed:
                        false,


                    hintRevealedAt:
                        null,


                    hintText:
                        null,


                    hasAnswer:
                        false,


                    answerUnlockAt:
                        null,


                    answerRemainingSeconds:
                        null,


                    answerUnlocked:
                        false,


                    answerRevealed:
                        false,


                    answerRevealedAt:
                        null,


                    answerText:
                        null

                }

            });
    }


    /* =====================================================
       LOAD CLUE + TIMING
    ===================================================== */

    const clueContext =
        await loadCurrentClueContext(
            team
        );


    if (
        clueContext.error
    ) {

        return res
            .status(
                clueContext
                    .error
                    .status
            )
            .json(
                clueContext
                    .error
                    .body
            );
    }


    const {

        route,

        scan

    } =
        clueContext;


    const assistance =
        buildAssistanceState(

            route,

            scan,

            Date.now()

        );


    /* =====================================================
       COMMON FINAL CP5
    ===================================================== */

    if (
        stage === 6
    ) {

        return res
            .status(200)
            .json({

                success:
                    true,

                finished:
                    false,

                serverNow,


                team: {

                    name:
                        team.team_name,

                    currentStage:
                        6

                },


                stageLabel:
                    "CP 5 / 5",


                clueTitle:
                    "Final Checkpoint",


                clue:
                    route.clue,


                clueImage:
                    route
                        .clue_image_url ||
                    null,


                scanButton:
                    "Scan Final QR",


                finalStage:
                    true,


                assistance

            });
    }


    /* =====================================================
       CP1 - CP4
    ===================================================== */

    const physicalCheckpoint =
        stage - 1;


    return res
        .status(200)
        .json({

            success:
                true,

            finished:
                false,

            serverNow,


            team: {

                name:
                    team.team_name,

                currentStage:
                    stage

            },


            stageLabel:
                `CP ${physicalCheckpoint} / 5`,


            clueTitle:
                `Checkpoint ${physicalCheckpoint}`,


            clue:
                route.clue,


            clueImage:
                route
                    .clue_image_url ||
                null,


            scanButton:
                "Scan QR",


            finalStage:
                false,


            assistance

        });
};