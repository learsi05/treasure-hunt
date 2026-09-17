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

    const cookieHeader =
        req.headers.cookie || "";

    const cookies =
        cookieHeader.split(";");

    for (const cookie of cookies) {

        const [key, ...valueParts] =
            cookie.trim().split("=");

        if (key === name) {

            return decodeURIComponent(
                valueParts.join("=")
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
async function handler(req, res) {

    if (req.method !== "POST") {

        return res
            .status(405)
            .json({
                success: false,
                message:
                    "Method not allowed"
            });
    }


    const {
        teamName,
        loginCode
    } = req.body || {};


    if (!teamName || !loginCode) {

        return res
            .status(400)
            .json({
                success: false,
                message:
                    "Enter team name and login code."
            });
    }


    const cleanTeamName =
        teamName.trim();

    const cleanLoginCode =
        loginCode
            .trim()
            .toUpperCase();


    // Find team using both
    // team name and login code.

    const {
        data: team,
        error
    } = await supabase
        .from("teams")
        .select(`
            id,
            team_name,
            login_code,
            active_session_token,
            current_checkpoint
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


    if (error) {

        console.error(
            "TEAM LOGIN ERROR:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Could not verify team."
            });
    }


    if (!team) {

        return res
            .status(401)
            .json({
                success: false,
                message:
                    "Incorrect team name or login code."
            });
    }


    // ---------------------------------
    // Check whether this browser
    // already owns the active session.
    // ---------------------------------

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


        if (
            existingHash ===
            team.active_session_token
        ) {

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Session restored.",
                    team: {
                        id:
                            team.id,

                        name:
                            team.team_name,

                        currentCheckpoint:
                            team.current_checkpoint
                    }
                });
        }
    }


    // ---------------------------------
    // Another browser already owns
    // this team's active session.
    // ---------------------------------

    if (team.active_session_token) {

        return res
            .status(409)
            .json({
                success: false,
                code:
                    "TEAM_ALREADY_ACTIVE",

                message:
                    "This team is already logged in on another device."
            });
    }


    // ---------------------------------
    // Create new secure session
    // ---------------------------------

    const rawToken =
        crypto
            .randomBytes(32)
            .toString("hex");


    const tokenHash =
        hashToken(rawToken);


    const {
        error: updateError
    } = await supabase
        .from("teams")
        .update({
            active_session_token:
                tokenHash,

            login_time:
                new Date()
                    .toISOString()
        })
        .eq(
            "id",
            team.id
        );


    if (updateError) {

        console.error(
            "SESSION CREATE ERROR:",
            updateError
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Could not create team session."
            });
    }


    // HttpOnly means JavaScript running
    // in the browser cannot read it.

    res.setHeader(
        "Set-Cookie",

        `treasure_session=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`
    );


    return res
        .status(200)
        .json({
            success: true,

            message:
                "Login successful.",

            team: {
                id:
                    team.id,

                name:
                    team.team_name,

                currentCheckpoint:
                    team.current_checkpoint
            }
        });
};