require("dotenv").config();
const mysql = require("mysql");
const util = require("util");

// Setup our mysql connection
let conn = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME,
	port: process.env.DB_PORT,
});
const query = util.promisify(conn.query).bind(conn);
conn.connect((err) => {
	if (err) throw err;
	console.log("Connected to DB");
});

let done = [];

// Get all stashes from stashitems
conn.query("SELECT * FROM stashitems", function (err, results) {
	if (err) throw err;
	var count = 0;
	results.forEach(async (row) => {
		// Iterate over all stashes
		const id = row.id;
		// Check if stash already exists in ox_inventory If it does skip it
		const check = await query(
			"SELECT COUNT(*) AS `count` FROM ox_inventory WHERE name = ?",
			[row.stash]
		);
		if (check[0].count === 0) {
			var itemsString = row.items;
			if (!itemsString.startsWith("[")) {
				itemsString = "[" + itemsString + "]";
			}
			let items = JSON.parse(itemsString);
			console.log("Count", count, "ID", id, "length", items.length);
			// Skip empty stashes as they will be re-registered when a item is placed in it.
			if (items.length !== 0) {
				var newItems = convertItems(items);
				var newIJson = JSON.stringify(newItems);
				conn.query(
					"INSERT INTO ox_inventory (owner ,name, data) VALUES ('', ?, ?) ",
					[row.stash, newIJson],
					function (results, err) {
						if (err) throw err;
						console.log(results);
					}
				);
				count++;
				return;
			}
		}
	});
});

/**
 * Convert all items in stash from qb-inventory to ox_inventory standard
 * @param {Array} items
 * @returns
 */
function convertItems(items) {
	var newItems = [];
	items.forEach((item) => {
		if (item !== null) {
			const newItem = {
				slot: item.slot,
				name: item.name,
				count: item.amount,
				metadata: item.info || {},
			};

			if (item.type === "weapon") {
				newItem.metadata = {
					durability: (item.info && item.info.quality) || 100,
					ammo: (item.info && item.info.ammo) || 0,
					components: {},
					serial: (item.info && item.info.serie) || "noserial",
					quality: null,
				};
			}

			newItems.push(newItem);
		}
	});

	return newItems;
}
