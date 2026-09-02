/**
 * Bulk Seed Script — inserts ~100 000 rows into every major table.
 * Run: node scripts/seed-bulk.js
 *
 * Tables seeded (in FK-dependency order):
 *   categories, variant_types, variant_values,
 *   users, customers, customer_addresses, suppliers, sections,
 *   products, inventory, stock_layers, stock_adjustments,
 *   purchase_orders, purchase_order_items,
 *   inv_purchase_vouchers, inv_purchase_voucher_items,
 *   sales, sale_details, credit_sales, credit_payments
 *
 * Prerequisites:
 *   - .env is present (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT)
 *   - DB already has the schema applied (role id=1 "Admin" must exist)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt  = require('bcryptjs');
const mariadb = require('mariadb');

// ─── Config ────────────────────────────────────────────────────────────────
const DB = {
  host:            process.env.DB_HOST     || 'localhost',
  port:            parseInt(process.env.DB_PORT || '3306'),
  user:            process.env.DB_USER     || 'root',
  password:        process.env.DB_PASSWORD || '',
  database:        process.env.DB_NAME     || 'abyte_pos',
  connectTimeout:  30000,
  bigIntAsNumber:  true,
};

const BATCH  = 1000;   // rows per INSERT statement
const TARGET = 100000; // rows per table

// ─── Helpers ───────────────────────────────────────────────────────────────
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = arr => arr[rand(0, arr.length - 1)];
const fmtD  = d => d.toISOString().slice(0, 10);           // YYYY-MM-DD
const fmtTS = d => d.toISOString().slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:MM:SS

function randDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

const CITIES  = ['Karachi','Lahore','Islamabad','Rawalpindi','Faisalabad','Peshawar','Quetta','Multan','Hyderabad','Sialkot'];
const METHODS = ['cash','card','online'];
const UNITS   = ['pcs','kg','g','litre','ml','box','dozen','set','pack','roll'];
const CAT_TYPES = ['finished_good','raw_material','semi_finished'];
const ADJ_TYPES = ['addition','subtraction','correction','damage','theft','return','opening_stock'];

async function batchInsert(conn, table, cols, rows) {
  if (!rows.length) return;
  const placeholders = '(' + cols.map(() => '?').join(',') + ')';
  const sql = `INSERT INTO \`${table}\` (${cols.map(c=>'`'+c+'`').join(',')}) VALUES ${placeholders}`;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    for (const row of chunk) {
      await conn.query(sql, row);
    }
    process.stdout.write(`\r  ${table}: ${Math.min(i + BATCH, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`);
  }
  console.log();
}

async function batchInsertMulti(conn, table, cols, rows) {
  // Faster: single INSERT … VALUES (…),(…),… per batch
  if (!rows.length) return;
  const colStr = cols.map(c=>'`'+c+'`').join(',');
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const placeholders = chunk.map(() => '(' + cols.map(() => '?').join(',') + ')').join(',');
    const flat = chunk.flat();
    const sql = `INSERT INTO \`${table}\` (${colStr}) VALUES ${placeholders}`;
    await conn.query(sql, flat);
    process.stdout.write(`\r  ${table}: ${Math.min(i + BATCH, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`);
  }
  console.log();
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function seed() {
  console.log('Connecting to', DB.host, '/', DB.database);
  const conn = await mariadb.createConnection(DB);
  await conn.query('SET foreign_key_checks = 0');
  await conn.query('SET unique_checks = 0');

  // ── Clean slate — truncate all seeded tables in reverse FK order ──────────
  console.log('\nCleaning existing seed data...');
  const TRUNCATE_ORDER = [
    'credit_payments','credit_sales','sale_details','sales',
    'inv_purchase_voucher_items','inv_purchase_vouchers',
    'purchase_order_items','purchase_orders','supplier_payments',
    'stock_adjustments','stock_layers','inventory',
    'customer_addresses','customers',
    'suppliers','sections','products',
    'variant_values','variant_types','categories',
    'users',
  ];
  for (const t of TRUNCATE_ORDER) {
    await conn.query(`TRUNCATE TABLE \`${t}\``);
  }
  // Restore the mandatory Walk-in Customer (customer_id = 1)
  await conn.query(`INSERT INTO customers (customer_id, customer_name, phone_number) VALUES (1, 'Walk-in Customer', NULL)`);
  console.log('Clean done.\n');

  const START = new Date('2022-01-01');
  const END   = new Date('2026-08-30');

  try {

    // ── 1. categories ──────────────────────────────────────────────────────
    console.log('\n[1/20] categories');
    const CAT_COUNT = 500; // category_name has UNIQUE constraint
    const catRows = [];
    for (let i = 1; i <= CAT_COUNT; i++) {
      catRows.push([`Category ${i}`, pick(CAT_TYPES), null, `Description for category ${i}`, 1]);
    }
    await batchInsertMulti(conn, 'categories',
      ['category_name','category_type','parent_id','description','is_active'], catRows);
    const [{ maxCat }] = await conn.query('SELECT MAX(category_id) AS maxCat FROM categories');

    // ── 2. variant_types ───────────────────────────────────────────────────
    console.log('\n[2/20] variant_types');
    const VT_NAMES = ['Size','Color','Material','Weight','Flavor','Scent','Style','Grade',
                      'Voltage','Capacity','Length','Width','Height','Thickness','Model',
                      'Edition','Pattern','Finish','Type','Brand'];
    for (const n of VT_NAMES) {
      await conn.query('INSERT IGNORE INTO variant_types (variant_name) VALUES (?)', [n]);
    }
    const vtRows = await conn.query('SELECT variant_type_id FROM variant_types');
    const vtIds = vtRows.map(r => r.variant_type_id);

    // ── 3. variant_values ──────────────────────────────────────────────────
    console.log('\n[3/20] variant_values');
    const vvRows = [];
    const VALUES_PER_TYPE = ['S','M','L','XL','XXL','Red','Blue','Green','Black','White',
      'Cotton','Polyester','Heavy','Light','1kg','2kg','500g','Sweet','Salty','Mint'];
    for (let i = 0; i < 200; i++) {
      vvRows.push([pick(vtIds), `${VALUES_PER_TYPE[i % VALUES_PER_TYPE.length]}-${i}`]);
    }
    await batchInsertMulti(conn, 'variant_values', ['variant_type_id','value_name'], vvRows);

    // ── 4. users ───────────────────────────────────────────────────────────
    console.log('\n[4/20] users  (5 000 rows — unique username/email required)');
    const pwdHash = await bcrypt.hash('Password@123', 8);
    const USER_COUNT = 5000;
    const userRows = [];
    const ROLES = ['Admin','Cashier','Manager','Storekeeper','Supervisor'];
    for (let i = 1; i <= USER_COUNT; i++) {
      const rname = pick(ROLES);
      userRows.push([
        `user_${i}`, `Staff Member ${i}`, `staff${i}@abyte.local`,
        pwdHash, 1, rname, 1
      ]);
    }
    await batchInsertMulti(conn, 'users',
      ['username','name','email','password_hash','role_id','role_name','is_active'], userRows);
    const [{ maxUser }] = await conn.query('SELECT MAX(user_id) AS maxUser FROM users');

    // ── 5. customers ───────────────────────────────────────────────────────
    console.log('\n[5/20] customers');
    const custRows = [];
    for (let i = 1; i <= TARGET; i++) {
      // Guaranteed unique: base 3000000000 + i => 03000000001 … 03000100000
      const phone = String(3000000000 + i);
      custRows.push([
        `Customer ${i}`,
        phone,
        `customer${i}@mail.com`,
        `Company ${i % 5000}`,
        rand(0, 1000000) / 100,
        rand(0, 500000) / 100,
        fmtTS(randDate(START, END))
      ]);
    }
    await batchInsertMulti(conn, 'customers',
      ['customer_name','phone_number','email','company','balance','credit_limit','created_at'], custRows);
    const [{ maxCust }] = await conn.query('SELECT MAX(customer_id) AS maxCust FROM customers');

    // ── 6. customer_addresses ──────────────────────────────────────────────
    console.log('\n[6/20] customer_addresses');
    const caRows = [];
    for (let i = 0; i < TARGET; i++) {
      caRows.push([
        rand(2, maxCust),
        `${rand(1,999)} Street ${rand(1,99)}, ${pick(CITIES)}`,
        pick(['Home','Office','Billing','Shipping']),
        i % 5 === 0 ? 1 : 0
      ]);
    }
    await batchInsertMulti(conn, 'customer_addresses',
      ['customer_id','address_text','label','is_default'], caRows);

    // ── 7. suppliers ───────────────────────────────────────────────────────
    console.log('\n[7/20] suppliers');
    const supRows = [];
    const SUP_COUNT = 10000;
    const TERMS = ['Net 30','Net 60','COD','Advance','Net 15'];
    for (let i = 1; i <= SUP_COUNT; i++) {
      supRows.push([
        `Supplier ${i} Ltd`,
        `Contact Person ${i}`,
        `021${String(rand(1000000,9999999))}`,
        `supplier${i}@mail.com`,
        `${rand(1,999)} Industrial Zone, ${pick(CITIES)}`,
        `TAX${String(i).padStart(7,'0')}`,
        pick(TERMS), 1
      ]);
    }
    await batchInsertMulti(conn, 'suppliers',
      ['supplier_name','contact_person','phone','email','address','tax_id','payment_terms','is_active'], supRows);
    const [{ maxSup }] = await conn.query('SELECT MAX(supplier_id) AS maxSup FROM suppliers');

    // ── 8. sections ────────────────────────────────────────────────────────
    console.log('\n[8/20] sections');
    const secRows = [];
    for (let i = 1; i <= 200; i++) {
      secRows.push([`Section ${i}`, `Department ${i}`, 1]);
    }
    await batchInsertMulti(conn, 'sections', ['section_name','description','is_active'], secRows);
    const [{ maxSec }] = await conn.query('SELECT MAX(section_id) AS maxSec FROM sections');

    // ── 9. products ────────────────────────────────────────────────────────
    console.log('\n[9/20] products');
    const prodRows = [];
    for (let i = 1; i <= TARGET; i++) {
      const cost  = rand(100, 50000) / 100;
      const price = +(cost * (1 + rand(10, 80) / 100)).toFixed(2);
      prodRows.push([
        `Product ${i}`,
        rand(1, maxCat),
        pick(['finished_good','raw_material','semi_finished']),
        pick(UNITS),
        price,
        price,
        cost,
        rand(0, 5000),
        rand(5, 50),
        rand(1, 20),
        0,
        `SKU${String(i).padStart(9,'0')}`,
        `BAR${String(i).padStart(10,'0')}`,
        `Description for product ${i}`,
        1,
        fmtTS(randDate(START, END))
      ]);
    }
    await batchInsertMulti(conn, 'products',
      ['product_name','category_id','product_type','unit','price','selling_price','cost_price',
       'stock_quantity','reorder_level','min_stock_level','has_variants','sku','barcode',
       'description','is_active','created_at'], prodRows);
    const [{ minProd }] = await conn.query('SELECT MIN(product_id) AS minProd FROM products');
    const [{ maxProd }] = await conn.query('SELECT MAX(product_id) AS maxProd FROM products');

    // ── 10. inventory ──────────────────────────────────────────────────────
    console.log('\n[10/20] inventory');
    const invRows = [];
    for (let pid = minProd; pid <= maxProd; pid++) {
      invRows.push([pid, rand(0, 10000), +(rand(100, 50000) / 100).toFixed(4)]);
    }
    await batchInsertMulti(conn, 'inventory',
      ['product_id','available_stock','avg_cost'], invRows);

    // ── 11. stock_layers ───────────────────────────────────────────────────
    console.log('\n[11/20] stock_layers');
    const slRows = [];
    const SL_SOURCES = ['purchase','opening','adjustment'];
    for (let i = 0; i < TARGET; i++) {
      const qty = rand(1, 500);
      slRows.push([
        rand(minProd, maxProd),
        null,
        pick(SL_SOURCES),
        fmtD(randDate(START, END)),
        qty,
        rand(0, qty),
        +(rand(50, 50000) / 100).toFixed(4)
      ]);
    }
    await batchInsertMulti(conn, 'stock_layers',
      ['product_id','pv_id','source_type','ref_date','qty_original','qty_remaining','unit_cost'], slRows);

    // ── 12. stock_adjustments ──────────────────────────────────────────────
    console.log('\n[12/20] stock_adjustments');
    const saRows = [];
    for (let i = 0; i < TARGET; i++) {
      const qBefore  = rand(0, 5000);
      const qAdjusted = rand(-200, 500);
      saRows.push([
        rand(minProd, maxProd),
        null, 1,
        pick(ADJ_TYPES),
        qBefore,
        Math.abs(qAdjusted),
        Math.max(0, qBefore + qAdjusted),
        `Reason ${i}`,
        `REF${i}`,
        rand(1, maxUser),
        fmtTS(randDate(START, END))
      ]);
    }
    await batchInsertMulti(conn, 'stock_adjustments',
      ['product_id','variant_id','store_id','adjustment_type','quantity_before',
       'quantity_adjusted','quantity_after','reason','reference_number','created_by','created_at'], saRows);

    // ── 13. purchase_orders ────────────────────────────────────────────────
    console.log('\n[13/20] purchase_orders');
    const poRows = [];
    const PO_STATUS = ['draft','pending','received','cancelled'];
    for (let i = 1; i <= TARGET; i++) {
      const oDate = randDate(START, END);
      const eDate = new Date(oDate); eDate.setDate(eDate.getDate() + rand(3, 30));
      poRows.push([
        `PO-${String(i).padStart(9,'0')}`,
        rand(1, maxSup),
        fmtD(oDate),
        fmtD(eDate),
        null,
        pick(PO_STATUS),
        +(rand(1000, 10000000) / 100).toFixed(2),
        +(rand(0, 50000) / 100).toFixed(2),
        `Notes for PO ${i}`,
        rand(1, maxUser),
        1,
        fmtTS(oDate)
      ]);
    }
    await batchInsertMulti(conn, 'purchase_orders',
      ['po_number','supplier_id','order_date','expected_date','received_date','status',
       'total_amount','additional_charges','notes','created_by','store_id','created_at'], poRows);
    const [{ minPO }] = await conn.query('SELECT MIN(po_id) AS minPO FROM purchase_orders');
    const [{ maxPO }] = await conn.query('SELECT MAX(po_id) AS maxPO FROM purchase_orders');

    // ── 14. purchase_order_items ───────────────────────────────────────────
    console.log('\n[14/20] purchase_order_items');
    const poiRows = [];
    for (let i = 0; i < TARGET; i++) {
      const qty  = rand(1, 500);
      const cost = +(rand(50, 50000) / 100).toFixed(2);
      poiRows.push([
        rand(minPO, maxPO),
        rand(minProd, maxProd),
        qty,
        rand(0, qty),
        cost,
        +(qty * cost).toFixed(2)
      ]);
    }
    await batchInsertMulti(conn, 'purchase_order_items',
      ['po_id','product_id','quantity_ordered','quantity_received','unit_cost','total_cost'], poiRows);

    // ── 15. inv_purchase_vouchers ──────────────────────────────────────────
    console.log('\n[15/20] inv_purchase_vouchers');
    const pvRows = [];
    for (let i = 1; i <= TARGET; i++) {
      const vDate  = randDate(START, END);
      const total  = +(rand(5000, 5000000) / 100).toFixed(2);
      pvRows.push([
        `PV-${String(i).padStart(9,'0')}`,  // pv_number
        rand(minPO, maxPO),                  // po_id
        rand(1, maxSup),                     // supplier_id
        fmtD(vDate),                         // voucher_date
        total,                               // total_amount
        +(rand(0, 50000) / 100).toFixed(2),  // shipping_cost
        +(rand(0, 20000) / 100).toFixed(2),  // extra_charges
        0,                                   // other_charges
        0,                                   // discount_percent
        0,                                   // discount_amount
        0,                                   // tax_percent
        0,                                   // tax_amount
        `Notes for PV ${i}`,                 // notes
        rand(1, maxUser),                    // created_by
        fmtTS(vDate)                         // created_at
      ]);
    }
    await batchInsertMulti(conn, 'inv_purchase_vouchers',
      ['pv_number','po_id','supplier_id','voucher_date','total_amount','shipping_cost',
       'extra_charges','other_charges','discount_percent','discount_amount',
       'tax_percent','tax_amount','notes','created_by','created_at'], pvRows);
    const [{ minPV }] = await conn.query('SELECT MIN(pv_id) AS minPV FROM inv_purchase_vouchers');
    const [{ maxPV }] = await conn.query('SELECT MAX(pv_id) AS maxPV FROM inv_purchase_vouchers');

    // ── 16. inv_purchase_voucher_items ─────────────────────────────────────
    console.log('\n[16/20] inv_purchase_voucher_items');
    const pviRows = [];
    for (let i = 0; i < TARGET; i++) {
      const qty   = +(rand(1, 1000) + rand(0, 999) / 1000).toFixed(3);
      const price = +(rand(50, 50000) / 100).toFixed(2);
      pviRows.push([
        rand(minPV, maxPV),
        rand(minProd, maxProd),
        qty,
        price,
        +(qty * price).toFixed(2)
      ]);
    }
    await batchInsertMulti(conn, 'inv_purchase_voucher_items',
      ['pv_id','product_id','quantity_received','unit_price','total_price'], pviRows);

    // ── 17. sales ──────────────────────────────────────────────────────────
    console.log('\n[17/20] sales');
    const saleRows = [];
    const SALE_STATUS = ['completed','pending','cancelled'];
    const ORDER_TYPES = ['on_spot','delivery','takeaway','dine_in'];
    const INV_PREFIX  = 'INV-';
    for (let i = 1; i <= TARGET; i++) {
      const sub  = +(rand(500, 1000000) / 100).toFixed(2);
      const disc = +(sub * rand(0, 20) / 100).toFixed(2);
      const tax  = +(sub * rand(0, 17) / 100).toFixed(2);
      const net  = +(sub - disc + tax).toFixed(2);
      const sDate = randDate(START, END);
      saleRows.push([
        sub, fmtTS(sDate), sub, disc, 0, 0, net,
        rand(1, maxUser),
        rand(1, maxCust),
        tax,
        pick(METHODS),
        pick(SALE_STATUS),
        rand(0, 17),
        0, 0,
        `Note ${i}`,
        net,
        `T${String(i).padStart(6,'0')}`,
        `${INV_PREFIX}${String(i).padStart(8,'0')}`,
        null,
        pick(ORDER_TYPES)
      ]);
    }
    await batchInsertMulti(conn, 'sales',
      ['sub_total','sale_date','total_amount','discount','bundle_discount','bundle_count',
       'net_amount','user_id','customer_id','tax_amount','payment_method','status',
       'tax_percent','additional_charges_percent','additional_charges_amount','note',
       'amount_paid','token_no','invoice_no','table_id','order_type'], saleRows);
    const [{ minSale }] = await conn.query('SELECT MIN(sale_id) AS minSale FROM sales');
    const [{ maxSale }] = await conn.query('SELECT MAX(sale_id) AS maxSale FROM sales');

    // ── 18. sale_details ───────────────────────────────────────────────────
    console.log('\n[18/20] sale_details');
    const sdRows = [];
    for (let i = 0; i < TARGET; i++) {
      const qty   = rand(1, 50);
      const price = +(rand(100, 100000) / 100).toFixed(2);
      const disc  = +(price * rand(0, 20) / 100).toFixed(2);
      sdRows.push([
        rand(minSale, maxSale),
        rand(minProd, maxProd),
        null, null,
        qty, price, disc,
        +((price - disc) * qty).toFixed(2),
        +(price * 0.2 * qty).toFixed(2),
        null
      ]);
    }
    await batchInsertMulti(conn, 'sale_details',
      ['sale_id','product_id','variant_id','variant_name','quantity','unit_price',
       'discount','total_price','profit','note'], sdRows);

    // ── 19. credit_sales ───────────────────────────────────────────────────
    console.log('\n[19/20] credit_sales');
    const crRows = [];
    const CR_STATUS = ['pending','partial','paid','overdue'];
    for (let i = 0; i < TARGET; i++) {
      const total   = +(rand(1000, 500000) / 100).toFixed(2);
      const paid    = +(total * rand(0, 100) / 100).toFixed(2);
      const balance = +(total - paid).toFixed(2);
      const dDate   = randDate(new Date(), new Date('2027-12-31'));
      crRows.push([
        rand(minSale, maxSale),
        rand(1, maxCust),
        total, paid, balance, balance,
        fmtD(dDate),
        pick(CR_STATUS),
        rand(1, maxUser),
        fmtTS(randDate(START, END))
      ]);
    }
    await batchInsertMulti(conn, 'credit_sales',
      ['sale_id','customer_id','total_amount','paid_amount','balance','balance_due',
       'due_date','status','created_by','created_at'], crRows);
    const [{ maxCR }] = await conn.query('SELECT MAX(credit_sale_id) AS maxCR FROM credit_sales');

    // ── 20. credit_payments ────────────────────────────────────────────────
    console.log('\n[20/20] credit_payments');
    const cpRows = [];
    for (let i = 0; i < TARGET; i++) {
      cpRows.push([
        rand(1, maxCR),
        +(rand(100, 100000) / 100).toFixed(2),
        pick(METHODS),
        rand(1, maxUser),
        `Payment note ${i}`,
        fmtTS(randDate(START, END))
      ]);
    }
    await batchInsertMulti(conn, 'credit_payments',
      ['credit_sale_id','amount','payment_method','received_by','notes','payment_date'], cpRows);

    // ── Done ───────────────────────────────────────────────────────────────
    console.log('\n✓ Bulk seed complete!');
    const tables = [
      'categories','variant_types','variant_values','users','customers','customer_addresses',
      'suppliers','sections','products','inventory','stock_layers','stock_adjustments',
      'purchase_orders','purchase_order_items','inv_purchase_vouchers',
      'inv_purchase_voucher_items','sales','sale_details','credit_sales','credit_payments'
    ];
    for (const t of tables) {
      const [{ cnt }] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
      console.log(`  ${t.padEnd(35)} ${Number(cnt).toLocaleString().padStart(10)} rows`);
    }

  } finally {
    await conn.query('SET foreign_key_checks = 1');
    await conn.query('SET unique_checks = 1');
    await conn.end();
  }
}

seed().catch(e => { console.error('\nSeed failed:', e.message); process.exit(1); });
