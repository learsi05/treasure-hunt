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

    const cookies =
        header.split(";");


    for (const cookie of cookies) {

        const [key, ...parts] =
            cookie.trim().split("=");

        if (key === name) {

            return decodeURIComponent(
                parts.join("=")
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

    if (req.method !== "GET") {

        return res
            .status(405)
            .json({
                success: false
            });
    }


    const token =
        getCookie(
            req,
            "treasure_session"
        );


    if (!token) {

        return res
            .status(401)
            .json({
                success: false,
                message:
                    "No active team session."
            });
    }


    const tokenHash =
        hashToken(token);


    const {
        data: team,
        error
    } = await supabase
        .from("teams")
        .select(`
            id,
            team_name,
            current_checkpoint,
            login_time,
            finished_at
        `)
        .eq(
            "active_session_token",
            tokenHash
        )
        .maybeSingle();


    if (error) {

        console.error(error);

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Could not verify session."
            });
    }


    if (!team) {

        return res
            .status(401)
            .json({
                success: false,
                message:
                    "Invalid team session."
            });
    }


    // Also return current event state.

    const {
        data: eventData
    } = await supabase
        .from("event_config")
        .select(`
            status,
            started_at
        `)
        .eq(
            "id",
            1
        )
        .maybeSingle();


    return res
        .status(200)
        .json({
            success: true,

            team: {
                id:
                    team.id,

                name:
                    team.team_name,

                currentCheckpoint:
                    team.current_checkpoint,

                finishedAt:
                    team.finished_at
            },

            event: {
                status:
                    eventData?.status ||
                    "waiting",

                startedAt:
                    eventData?.started_at ||
                    null
            }
        });
};