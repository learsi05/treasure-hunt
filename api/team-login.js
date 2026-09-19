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

    const cookieHeader =
        req.headers.cookie || "";


    const cookies =
        cookieHeader.split(";");


    for (
        const cookie
        of cookies
    ) {

        const [
            key,
            ...valueParts
        ] =
            cookie
                .trim()
                .split("=");


        if (
            key === name
        ) {

            const value =
                valueParts.join("=");


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
       INPUT
    ===================================================== */

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
                    "Enter team name and login code."

            });
    }


    /* =====================================================
       FIND TEAM
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
                login_code,
                active_session_token,
                current_checkpoint,
                camera_ready,
                ready_at,
                finished_at
            `)
            .ilike(
                "team_name",
                cleanTeamName
            )
            .eq(
                "login_code",
                cleanLoginCode
            )
            .maybeSingle();


    if (
        teamError
    ) {

        console.error(
            "TEAM LOGIN ERROR:",
            teamError
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


    if (!team) {

        return res
            .status(401)
            .json({

                success:
                    false,

                message:
                    "Incorrect team name or login code."

            });
    }


    /* =====================================================
       CHECK EXISTING BROWSER SESSION
    ===================================================== */

    const existingCookie =
        getCookie(
            req,
            "treasure_session"
        );


    if (
        existingCookie &&
        team.active_session_token
    ) {

        const existingHash =
            hashToken(
                existingCookie
            );


        /*
         * Same browser already owns
         * the active session.
         */

        if (
            existingHash ===
            team.active_session_token
        ) {

            return res
                .status(200)
                .json({

                    success:
                        true,

                    restored:
                        true,

                    message:
                        "Session restored.",


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
                            Boolean(
                                team.camera_ready
                            ),

                        finished:
                            Boolean(
                                team.finished_at
                            ),

                        finishedAt:
                            team.finished_at ||
                            null

                    }

                });
        }
    }


    /* =====================================================
       ANOTHER DEVICE ALREADY OWNS SESSION
    ===================================================== */

    if (
        team.active_session_token
    ) {

        return res
            .status(409)
            .json({

                success:
                    false,

                code:
                    "TEAM_ALREADY_ACTIVE",

                message:
                    "This team is already logged in on another device. Ask the administrator to reset the team's login session if required."

            });
    }


    /* =====================================================
       CREATE SECURE SESSION
    ===================================================== */

    const rawToken =
        crypto
            .randomBytes(
                32
            )
            .toString(
                "hex"
            );


    const tokenHash =
        hashToken(
            rawToken
        );


    const loginTime =
        new Date()
            .toISOString();


    /*
     * IMPORTANT:
     *
     * Only claim this team if
     * active_session_token is STILL null.
     *
     * This prevents two devices logging
     * into the same team simultaneously.
     */

    const {
        data: claimedTeam,
        error: updateError
    } =
        await supabase
            .from(
                "teams"
            )
            .update({

                active_session_token:
                    tokenHash,

                login_time:
                    loginTime

            })
            .eq(
                "id",
                team.id
            )
            .is(
                "active_session_token",
                null
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
            "SESSION CREATE ERROR:",
            updateError
        );


        return res
            .status(500)
            .json({

                success:
                    false,

                message:
                    "Could not create team session."

            });
    }


    /* =====================================================
       ANOTHER LOGIN WON THE RACE
    ===================================================== */

    if (!claimedTeam) {

        return res
            .status(409)
            .json({

                success:
                    false,

                code:
                    "TEAM_ALREADY_ACTIVE",

                message:
                    "This team has just been logged in on another device. Ask the administrator to reset the login session if necessary."

            });
    }


    /* =====================================================
       SESSION COOKIE
    ===================================================== */

    /*
     * HttpOnly:
     * JavaScript cannot read the token.
     *
     * Secure:
     * Sent only over HTTPS.
     *
     * SameSite=Strict:
     * Helps protect against cross-site
     * request attacks.
     *
     * Max-Age=43200:
     * 12 hours.
     */

    res.setHeader(
        "Set-Cookie",

        `treasure_session=${encodeURIComponent(
            rawToken
        )}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`
    );


    /* =====================================================
       SUCCESS
    ===================================================== */

    return res
        .status(200)
        .json({

            success:
                true,

            restored:
                false,

            message:
                "Login successful.",


            team: {

                id:
                    claimedTeam.id,

                name:
                    claimedTeam.team_name,

                currentCheckpoint:
                    Number(
                        claimedTeam.current_checkpoint
                    ),

                cameraReady:
                    Boolean(
                        claimedTeam.camera_ready
                    ),

                finished:
                    Boolean(
                        claimedTeam.finished_at
                    ),

                finishedAt:
                    claimedTeam.finished_at ||
                    null

            }

        });
};