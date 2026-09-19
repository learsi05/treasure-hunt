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
   TIMER SETTINGS
========================================================= */

const HINT_DELAY_MS =
    5 * 60 * 1000;


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
   LOG WRONG SCAN
========================================================= */

async function logScanAttempt(
    teamId,
    scannedQr,
    expectedCheckpoint,
    result
) {

    try {

        await supabase
            .from(
                "scan_attempts"
            )
            .insert({

                team_id:
                    teamId,

                scanned_qr:
                    scannedQr,

                expected_checkpoint:
                    expectedCheckpoint,

                result

            });


    } catch (error) {

        console.error(
            "SCAN ATTEMPT LOG ERROR:",
            error
        );
    }
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


    /* =====================================================
       QR VALUE
    ===================================================== */

    const {
        qrCode
    } =
        req.body || {};


    if (!qrCode) {

        return res
            .status(400)
            .json({

                success:
                    false,

                message:
                    "No QR detected."

            });
    }


    const scanned =
        String(
            qrCode
        )
            .trim();


    if (!scanned) {

        return res
            .status(400)
            .json({

                success:
                    false,

                message:
                    "No QR detected."

            });
    }


    /* =====================================================
       TEAM SESSION
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
                    "Team session expired."

            });
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
            "TEAM LOAD ERROR:",
            teamError
        );


        return res
            .status(500)
            .json({

                success:
                    false,

                message:
                    "Could not load team information."

            });
    }


    if (!team) {

        return res
            .status(401)
            .json({

                success:
                    false,

                message:
                    "Team session expired."

            });
    }


    if (
        team.finished_at
    ) {

        return res
            .status(400)
            .json({

                success:
                    false,

                code:
                    "ALREADY_FINISHED",

                message:
                    "This team has already finished."

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

                success:
                    false,

                message:
                    "Could not load event information."

            });
    }


    if (
        event.status !==
        "running"
    ) {

        return res
            .status(409)
            .json({

                success:
                    false,

                code:
                    "EVENT_NOT_RUNNING",

                message:
                    "The event is not currently running."

            });
    }


    const stage =
        Number(
            team.current_checkpoint
        );


    /* =====================================================
       FINAL COMMON QR
       STAGE 6
    ===================================================== */

    if (
        stage === 6
    ) {

        /*
         * Final checkpoint must
         * actually be configured.
         */

        if (
            !event.final_qr_code
        ) {

            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "The final checkpoint has not been configured."

                });
        }


        /* -------------------------------------------------
           WRONG FINAL QR
        ------------------------------------------------- */

        if (
            scanned !==
            event.final_qr_code
        ) {

            await logScanAttempt(

                team.id,

                scanned,

                6,

                "WRONG_FINAL_QR"

            );


            return res
                .status(400)
                .json({

                    success:
                        false,

                    code:
                        "WRONG_FINAL_QR",

                    message:
                        "This is not the final treasure QR."

                });
        }


        /* -------------------------------------------------
           FINISH TEAM
        ------------------------------------------------- */

        const finishTime =
            new Date()
                .toISOString();


        const {
            error: finalScanError
        } =
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


        if (
            finalScanError
        ) {

            console.error(
                "FINAL SCAN ERROR:",
                finalScanError
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not record final checkpoint."

                });
        }


        const {
            error: finishUpdateError
        } =
            await supabase
                .from(
                    "teams"
                )
                .update({

                    finished_at:
                        finishTime

                })
                .eq(
                    "id",
                    team.id
                );


        if (
            finishUpdateError
        ) {

            console.error(
                "TEAM FINISH ERROR:",
                finishUpdateError
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Final QR was recorded, but the team finish state could not be updated."

                });
        }


        /* =================================================
           CHECK WHETHER EVERY TEAM FINISHED
        ================================================= */

        const {
            count: totalTeams,
            error: totalTeamsError
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


        const {
            count: finishedTeams,
            error: finishedTeamsError
        } =
            await supabase
                .from(
                    "final_scans"
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
            !totalTeamsError &&
            !finishedTeamsError &&
            totalTeams > 0 &&
            finishedTeams >=
            totalTeams
        ) {

            const {
                error: finishEventError
            } =
                await supabase
                    .from(
                        "event_config"
                    )
                    .update({

                        status:
                            "finished"

                    })
                    .eq(
                        "id",
                        1
                    );


            if (
                finishEventError
            ) {

                console.error(
                    "EVENT FINISH ERROR:",
                    finishEventError
                );
            }
        }


        return res
            .status(200)
            .json({

                success:
                    true,

                finished:
                    true,

                finishTime,

                serverNow:
                    finishTime,

                message:
                    "Treasure secured!"

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

        await logScanAttempt(

            team.id,

            scanned,

            stage,

            "FINAL_LOCKED"

        );


        return res
            .status(400)
            .json({

                success:
                    false,

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
        data: expected,
        error: expectedError
    } =
        await supabase
            .from(
                "team_routes"
            )
            .select(`
                qr_code,
                clue,
                clue_image_url,
                hint,
                answer,
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
            .maybeSingle();


    if (
        expectedError
    ) {

        console.error(
            "EXPECTED ROUTE ERROR:",
            expectedError
        );


        return res
            .status(500)
            .json({

                success:
                    false,

                message:
                    "Could not load the current route."

            });
    }


    if (!expected) {

        return res
            .status(500)
            .json({

                success:
                    false,

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

        /*
         * This is the authoritative
         * clue-reveal timestamp.
         *
         * Hint becomes available
         * exactly 5 minutes after
         * this timestamp.
         */

        const scanTime =
            new Date()
                .toISOString();


        const hintExists =
            Boolean(
                expected.hint &&
                expected.hint.trim()
            );


        const answerExists =
            Boolean(
                hintExists &&
                expected.answer &&
                expected.answer.trim()
            );


        const hintUnlockAt =
            hintExists
                ?
                new Date(
                    new Date(
                        scanTime
                    )
                        .getTime()
                    +
                    HINT_DELAY_MS
                )
                    .toISOString()
                :
                null;


        /* -------------------------------------------------
           RECORD CHECKPOINT
        ------------------------------------------------- */

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
                            scanTime,

                        /*
                         * New clue = new assistance
                         * state.
                         */

                        hint_revealed_at:
                            null,

                        answer_revealed_at:
                            null

                    },
                    {
                        onConflict:
                            "team_id,checkpoint_number"
                    }
                );


        if (
            scanError
        ) {

            console.error(
                "CHECKPOINT RECORD ERROR:",
                scanError
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not record checkpoint."

                });
        }


        /* -------------------------------------------------
           ADVANCE TEAM
        ------------------------------------------------- */

        const nextStage =
            stage + 1;


        const {
            error: advanceError
        } =
            await supabase
                .from(
                    "teams"
                )
                .update({

                    current_checkpoint:
                        nextStage

                })
                .eq(
                    "id",
                    team.id
                )
                .eq(
                    "current_checkpoint",
                    stage
                );


        if (
            advanceError
        ) {

            console.error(
                "TEAM ADVANCE ERROR:",
                advanceError
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Checkpoint was recorded, but the route could not advance."

                });
        }


        /* -------------------------------------------------
           COMPLETED LABEL
        ------------------------------------------------- */

        let completedLabel;


        if (
            stage === 1
        ) {

            completedLabel =
                "Starting QR";

        } else {

            completedLabel =
                `Checkpoint ${
                    stage - 1
                }`;
        }


        /* -------------------------------------------------
           SUCCESS RESPONSE
        ------------------------------------------------- */

        return res
            .status(200)
            .json({

                success:
                    true,

                finished:
                    false,


                serverNow:
                    scanTime,


                completedStage:
                    stage,


                completedLabel,


                nextStage,


                /*
                 * Clue is revealed
                 * immediately.
                 */

                revealedClue:
                    expected.clue,


                revealedClueImage:
                    expected.clue_image_url ||
                    null,


                /*
                 * Do NOT return
                 * Hint or Answer text.
                 *
                 * Only return their
                 * availability state.
                 */

                assistance: {

                    clueAvailableAt:
                        scanTime,


                    hasHint:
                        hintExists,


                    hintUnlockAt,


                    hintRemainingSeconds:
                        hintExists
                            ?
                            300
                            :
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
                        answerExists,


                    /*
                     * Answer countdown
                     * has NOT started yet.
                     *
                     * It starts only when
                     * VIEW HINT is pressed.
                     */

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

                },


                finalStage:
                    nextStage === 6

            });
    }


    /* =====================================================
       WRONG QR CLASSIFICATION
    ===================================================== */

    const {
        data: qrOwner,
        error: ownerError
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


    if (
        ownerError
    ) {

        console.error(
            "QR OWNER LOOKUP ERROR:",
            ownerError
        );
    }


    let resultCode =
        "UNKNOWN_QR";


    let message =
        "This QR is not part of your current path.";


    if (
        qrOwner
    ) {

        /* -------------------------------------------------
           ANOTHER TEAM
        ------------------------------------------------- */

        if (
            Number(
                qrOwner.team_id
            ) !==
            Number(
                team.id
            )
        ) {

            resultCode =
                "WRONG_TEAM";


            message =
                "This QR belongs to another team.";
        }


        /* -------------------------------------------------
           FUTURE QR
        ------------------------------------------------- */

        else if (
            Number(
                qrOwner.checkpoint_number
            ) >
            stage
        ) {

            resultCode =
                "FUTURE_CHECKPOINT";


            message =
                "You found a future checkpoint. Complete your current stage first.";
        }


        /* -------------------------------------------------
           OLD QR
        ------------------------------------------------- */

        else if (
            Number(
                qrOwner.checkpoint_number
            ) <
            stage
        ) {

            resultCode =
                "OLD_CHECKPOINT";


            message =
                "You have already completed this QR.";
        }


        /*
         * This condition should
         * almost never happen,
         * because the expected QR
         * comparison above would
         * already have succeeded.
         */

        else {

            resultCode =
                "INVALID_CURRENT_QR";


            message =
                "This QR does not match your current checkpoint.";
        }
    }


    /* =====================================================
       LOG FAILED ATTEMPT
    ===================================================== */

    await logScanAttempt(

        team.id,

        scanned,

        stage,

        resultCode

    );


    /* =====================================================
       FAILED RESPONSE
    ===================================================== */

    return res
        .status(400)
        .json({

            success:
                false,

            code:
                resultCode,

            message

        });
};