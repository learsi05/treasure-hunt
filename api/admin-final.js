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

            return values.join("=");
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
async function handler(
    req,
    res
) {

    if (!authorized(req)) {

        return res
            .status(401)
            .json({
                success: false,

                message:
                    "Administrator session expired."
            });
    }


    if (
        req.method === "GET"
    ) {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "event_config"
                )
                .select(
                    "final_qr_code"
                )
                .eq(
                    "id",
                    1
                )
                .single();


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

                finalQrCode:
                    data.final_qr_code
            });
    }


    if (
        req.method === "POST"
    ) {

        const {
            finalQrCode
        } =
            req.body || {};


        if (
            !finalQrCode ||
            !finalQrCode.trim()
        ) {

            return res
                .status(400)
                .json({
                    success: false,

                    message:
                        "Final QR value is required."
                });
        }


        const cleanCode =
            finalQrCode.trim();


        /*
         * Make sure the final QR is not
         * already used in a team route.
         */

        const {
            data: existingRoute
        } =
            await supabase
                .from(
                    "team_routes"
                )
                .select(
                    "id"
                )
                .eq(
                    "qr_code",
                    cleanCode
                )
                .maybeSingle();


        if (existingRoute) {

            return res
                .status(400)
                .json({
                    success: false,

                    message:
                        "This QR is already assigned to a team checkpoint."
                });
        }


        const {
            error
        } =
            await supabase
                .from(
                    "event_config"
                )
                .update({
                    final_qr_code:
                        cleanCode
                })
                .eq(
                    "id",
                    1
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