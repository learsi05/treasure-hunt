const { createClient } =
    require(
        "@supabase/supabase-js"
    );

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

            return values
                .join("=");
        }
    }

    return null;
}


function adminToken() {

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
        adminToken()
    );
}


module.exports =
async function handler(req, res) {


    if (!authorized(req)) {

        return res
            .status(401)
            .json({
                success: false,

                message:
                    "Administrator session expired."
            });
    }


    /* GET TEAMS */

    if (
        req.method === "GET"
    ) {

        const {
            data,
            error
        } =
            await supabase
                .from("teams")
                .select(`
                    id,
                    team_name,
                    login_code,
                    current_checkpoint,
                    active_session_token,
                    login_time,
                    finished_at
                `)
                .order(
                    "id"
                );


        if (error) {

            return res
                .status(500)
                .json({
                    success: false,

                    message:
                        error.message
                });
        }


        return res
            .status(200)
            .json({
                success: true,

                teams: data
            });
    }


    /* CREATE TEAM */

    if (
        req.method === "POST"
    ) {

        const {
            teamName,
            loginCode
        } =
            req.body || {};


        if (
            !teamName ||
            !loginCode
        ) {

            return res
                .status(400)
                .json({
                    success: false,

                    message:
                        "Enter both team name and login code."
                });
        }


        const {
            count
        } =
            await supabase
                .from("teams")
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
            count >= 4
        ) {

            return res
                .status(400)
                .json({
                    success: false,

                    message:
                        "All four team slots are already registered."
                });
        }


        const {
            data,
            error
        } =
            await supabase
                .from("teams")
                .insert([
                    {
                        team_name:
                            teamName
                                .trim(),

                        login_code:
                            loginCode
                                .trim()
                                .toUpperCase()
                    }
                ])
                .select()
                .single();


        if (error) {

            return res
                .status(400)
                .json({
                    success: false,

                    message:
                        error.message
                });
        }


        return res
            .status(201)
            .json({
                success: true,

                team: data
            });
    }


    /* DELETE TEAM */

    if (
        req.method === "DELETE"
    ) {

        const {
            teamId
        } =
            req.body || {};


        const {
            error
        } =
            await supabase
                .from("teams")
                .delete()
                .eq(
                    "id",
                    teamId
                );


        if (error) {

            return res
                .status(500)
                .json({
                    success: false,

                    message:
                        error.message
                });
        }


        return res
            .status(200)
            .json({
                success: true
            });
    }


    /* RESET LOGIN SESSION */

    if (
        req.method === "PATCH"
    ) {

        const {
            teamId
        } =
            req.body || {};


        const {
            error
        } =
            await supabase
                .from("teams")
                .update({

                    active_session_token:
                        null,

                    login_time:
                        null

                })
                .eq(
                    "id",
                    teamId
                );


        if (error) {

            return res
                .status(500)
                .json({
                    success: false,

                    message:
                        error.message
                });
        }


        return res
            .status(200)
            .json({
                success: true
            });
    }


    return res
        .status(405)
        .json({
            success: false
        });
};