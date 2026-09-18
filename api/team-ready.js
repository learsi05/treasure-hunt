const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
        auth: {
            persistSession: false
        }
    }
);

function getCookie(req, name) {
    const header = req.headers.cookie || "";

    for (const cookie of header.split(";")) {
        const [key, ...values] = cookie.trim().split("=");

        if (key === name) {
            return decodeURIComponent(values.join("="));
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

module.exports = async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    const token = getCookie(
        req,
        "treasure_session"
    );

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "No active team session."
        });
    }

    const tokenHash = hashToken(token);

    const {
        data: team,
        error: teamError
    } = await supabase
        .from("teams")
        .select("id, team_name")
        .eq(
            "active_session_token",
            tokenHash
        )
        .maybeSingle();

    if (teamError || !team) {
        return res.status(401).json({
            success: false,
            message: "Invalid team session."
        });
    }

    const {
        error: updateError
    } = await supabase
        .from("teams")
        .update({
            camera_ready: true,
            ready_at: new Date().toISOString()
        })
        .eq(
            "id",
            team.id
        );

    if (updateError) {
        console.error(updateError);

        return res.status(500).json({
            success: false,
            message: "Could not mark team ready."
        });
    }

    return res.status(200).json({
        success: true,
        message: "Team ready."
    });
};