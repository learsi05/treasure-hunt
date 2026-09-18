const { createClient } =
    require("@supabase/supabase-js");

const crypto =
    require("crypto");


const supabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
    );


function getCookie(req, name) {

    const header =
        req.headers.cookie || "";

    for (const cookie of header.split(";")) {

        const [
            key,
            ...values
        ] =
            cookie.trim().split("=");

        if (key === name) {

            return decodeURIComponent(
                values.join("=")
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

    const token =
        getCookie(
            req,
            "treasure_session"
        );


    if (!token) {

        return res.status(401).json({
            success: false
        });
    }


    const hash =
        hashToken(token);


    const {
        data: team
    } = await supabase
        .from("teams")
        .select(`
            id,
            team_name,
            current_checkpoint,
            finished_at
        `)
        .eq(
            "active_session_token",
            hash
        )
        .maybeSingle();


    if (!team) {

        return res.status(401).json({
            success: false
        });
    }


    const {
        data: event
    } = await supabase
        .from("event_config")
        .select(`
            status,
            started_at
        `)
        .eq("id", 1)
        .single();


    if (
        event.status !==
        "running"
    ) {

        return res.status(409).json({
            success: false,
            eventStatus:
                event.status
        });
    }


    if (
        team.current_checkpoint > 5
    ) {

        return res.status(200).json({
            success: true,

            team,

            finalStage: true
        });
    }


    const {
        data: route
    } = await supabase
        .from("team_routes")
        .select(`
            checkpoint_number,
            clue
        `)
        .eq(
            "team_id",
            team.id
        )
        .eq(
            "checkpoint_number",
            team.current_checkpoint
        )
        .single();


    if (!route) {

        return res.status(500).json({
            success: false,
            message:
                "Checkpoint route is not configured."
        });
    }


    return res.status(200).json({

        success: true,

        team: {
            id:
                team.id,

            name:
                team.team_name,

            currentCheckpoint:
                team.current_checkpoint
        },

        clue:
            route.clue,

        finalStage:
            false
    });
};