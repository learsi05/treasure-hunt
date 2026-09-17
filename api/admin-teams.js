const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
        auth: {
            persistSession: false
        }
    }
);

module.exports = async function handler(req, res) {

    const adminPassword = req.headers["x-admin-password"];

    if (
        !adminPassword ||
        adminPassword !== process.env.ADMIN_PASSWORD
    ) {
        return res.status(401).json({
            success: false,
            message: "Invalid admin password"
        });
    }

    if (req.method === "GET") {

        const { data, error } = await supabase
            .from("teams")
            .select("*")
            .order("id");

        if (error) {
            console.error(error);

            return res.status(500).json({
                success: false,
                message: "Could not load teams"
            });
        }

        return res.status(200).json({
            success: true,
            teams: data
        });
    }

    if (req.method === "POST") {

        const {
            teamName,
            loginCode
        } = req.body || {};

        if (!teamName || !loginCode) {
            return res.status(400).json({
                success: false,
                message: "Team name and login code are required"
            });
        }

        const {
            count,
            error: countError
        } = await supabase
            .from("teams")
            .select("*", {
                count: "exact",
                head: true
            });

        if (countError) {
            return res.status(500).json({
                success: false,
                message: "Could not check team count"
            });
        }

        if (count >= 4) {
            return res.status(400).json({
                success: false,
                message: "Maximum of 4 teams already registered"
            });
        }

        const { data, error } = await supabase
            .from("teams")
            .insert([
                {
                    team_name: teamName.trim(),
                    login_code: loginCode.trim().toUpperCase()
                }
            ])
            .select()
            .single();

        if (error) {
            console.error(error);

            if (error.code === "23505") {
                return res.status(400).json({
                    success: false,
                    message: "Team name or login code already exists"
                });
            }

            return res.status(500).json({
                success: false,
                message: "Could not create team"
            });
        }

        return res.status(201).json({
            success: true,
            team: data
        });
    }

    return res.status(405).json({
        success: false,
        message: "Method not allowed"
    });
};