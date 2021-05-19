const dbEngine = process.env.DB_ENVIRONMENT || "production";
const config = requires("./knexfile")[dbEngine];
module.exports = requires("knex")(config);