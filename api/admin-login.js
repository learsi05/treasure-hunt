const crypto =
    require("crypto");


function createAdminToken() {

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


module.exports =
async function handler(req, res) {

    if (req.method !== "POST") {

        return res
            .status(405)
            .json({
                success: false
            });
    }


    const { password } =
        req.body || {};


    if (
        !password ||
        password !==
        process.env.ADMIN_PASSWORD
    ) {

        return res
            .status(401)
            .json({
                success: false,

                message:
                    "Incorrect administrator password."
            });
    }


    const token =
        createAdminToken();


    res.setHeader(

        "Set-Cookie",

        `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`

    );


    return res
        .status(200)
        .json({
            success: true
        });
};