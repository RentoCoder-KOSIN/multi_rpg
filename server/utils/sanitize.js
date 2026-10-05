// クライアントから届いた職業IDを検証する（半角英数字と _ のみ・32文字まで）。不正なら null。
function cleanJobId(job) {
    return (typeof job === "string" && /^[A-Za-z0-9_]{1,32}$/.test(job)) ? job : null;
}

module.exports = { cleanJobId };
