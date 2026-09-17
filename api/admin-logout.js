module.exports =
async function handler(req, res) {

    res.setHeader(
        "Set-Cookie",

        "admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
    );


    return res
        .status(200)
        .json({
            success: true
        });
};