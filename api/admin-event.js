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

    const header =
        req.headers.cookie || "";

    for (const cookie of header.split(";")) {

        const [
            key,
            ...values
        ] = cookie.trim().split("=");

        if (key === name) {
            return values.join("=");
        }
    }

    return null;
}

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

module.exports = async function handler(req, res) {

    if (!authorized(req)) {

        return res.status(401).json({
            success: false,
            message:
                "Administrator session expired."
        });
    }

    // --------------------------
    // GET EVENT STATUS
    // --------------------------

    if (req.method === "GET") {

        const {
            data: event,
            error
        } = await supabase
            .from("event_config")
            .select(`
                status,
                started_at
            `)
            .eq("id", 1)
            .single();

        if (error) {

            return res.status(500).json({
                success: false,
                message:
                    "Could not load event."
            });
        }

        const {
            data: teams
        } = await supabase
            .from("teams")
            .select(`
                id,
                team_name,
                camera_ready
            `)
            .order("id");

        return res.status(200).json({
            success: true,
            event,
            teams: teams || []
        });
    }

    // --------------------------
    // START EVENT
    // --------------------------

    if (req.method === "POST") {

        const {
            data: event
        } = await supabase
            .from("event_config")
            .select("status")
            .eq("id", 1)
            .single();

        if (
            event &&
            event.status === "running"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "The event has already started."
            });
        }

        const {
            data: teams,
            error: teamError
        } = await supabase
            .from("teams")
            .select(`
                id,
                team_name,
                camera_ready
            `);

        if (teamError) {

            return res.status(500).json({
                success: false,
                message:
                    "Could not check team readiness."
            });
        }

        if (teams.length !== 4) {

            return res.status(400).json({
                success: false,
                message:
                    "Exactly 4 teams must be registered before starting."
            });
        }

        const notReady =
            teams.filter(
                team =>
                    !team.camera_ready
            );

        if (notReady.length > 0) {

            return res.status(400).json({
                success: false,

                message:
                    "All four teams must complete the camera check before the event can start.",

                notReady:
                    notReady.map(
                        team =>
                            team.team_name
                    )
            });
        }

        const startTime =
            new Date().toISOString();

        const {
            error: startError
        } = await supabase
            .from("event_config")
            .update({
                status: "running",
                started_at: startTime
            })
            .eq("id", 1);

        if (startError) {

            return res.status(500).json({
                success: false,
                message:
                    "Could not start event."
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Treasure Hunt started!",
            startedAt:
                startTime
        });
    }

    return res.status(405).json({
        success: false
    });
};