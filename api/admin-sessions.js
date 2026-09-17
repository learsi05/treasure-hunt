const crypto =
    require("crypto");


function getCookie(
    req,
    name
) {

    const header =
        req.headers.cookie || "";

    const cookies =
        header.split(";");


    for (
        const cookie
        of cookies
    ) {

        const [
            key,
            ...values
        ] =
            cookie
                .trim()
                .split("=");


        if (
            key === name
        ) {

            return values
                .join("=");
        }
    }

    return null;
}


function expectedToken() {

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
async function handler(
    req,
    res
) {

    const token =
        getCookie(
            req,
            "admin_session"
        );


    if (
        !token ||
        token !==
        expectedToken()
    ) {

        return res
            .status(401)
            .json({
                success: false
            });
    }


    return res
        .status(200)
        .json({
            success: true
        });
};