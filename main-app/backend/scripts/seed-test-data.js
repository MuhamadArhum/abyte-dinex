/**
 * Test Data Seed Script — appends ~10,000 rows to each core business table.
 * Run: node scripts/seed-test-data.js
 *
 * SAFE / NON-DESTRUCTIVE:
 *   - Does NOT touch `users` or `roles` — your real login accounts are untouched.
 *   - Does NOT truncate anything — it only INSERTs new rows on top of what's there.
 *   - The existing Walk-in Customer (customer_id = 1) is left alone.
 *
 * Tables seeded (in FK-dependency order), ~10,000 rows each:
 *   categories, products, inventory, customers, suppliers,
 *   sales, sale_details, purchase_orders, credit_sales,
 *   quotations, deliveries, returns, stock_adjustments
 *
 * Prerequisites:
 *   - .env is present (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT)
 *   - At least one row already exists in `users` (used for created_by/user_id FKs)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mariadb = require('mariadb');

const DB = {
  host:           process.env.DB_HOST     || 'localhost',
  port:           parseInt(process.env.DB_PORT || '3306'),
  user:           process.env.DB_USER     || 'root',
  password:       process.env.DB_PASSWORD || '',
  database:       process.env.DB_NAME     || 'abyte_pos',
  connectTimeout: 30000,
  bigIntAsNumber: true,
};

const BATCH  = 1000;   // rows per INSERT statement
const TARGET = 10000;  // rows per table

// ─── Helpers ───────────────────────────────────────────────────────────────
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = arr => arr[rand(0, arr.length - 1)];
const fmtD  = d => d.toISOString().slice(0, 10);
const fmtTS = d => d.toISOString().slice(0, 19).replace('T', ' ');
const randDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const CITIES      = ['Karachi','Lahore','Islamabad','Rawalpindi','Faisalabad','Peshawar','Quetta','Multan','Hyderabad','Sialkot'];
const METHODS     = ['Cash','Card','Online'];
const UNITS       = ['pcs','kg','g','litre','ml','box','dozen','set','pack','roll'];
const CAT_TYPES   = ['finished_good','raw_material','semi_finished'];
const ADJ_TYPES   = ['addition','subtraction','correction','damage','theft','return','opening_stock','expired'];
const PO_STATUS   = ['draft','pending','received','cancelled'];
const CR_STATUS   = ['pending','partial','paid','overdue'];
const QUOTE_STATUS= ['draft','sent','accepted','rejected','expired','converted'];
const DEL_STATUS  = ['pending','assigned','dispatched','in_transit','delivered','failed','cancelled'];
const ORDER_TYPES = ['on_spot','delivery','takeaway','dine_in'];
const FIRST_NAMES = ['Ahmed','Ali','Hassan','Bilal','Usman','Fahad','Zain','Hamza','Saad','Umar','Ayesha','Fatima','Sana','Hira','Zainab','Mahnoor','Amina','Sara','Nida','Rabia'];
const LAST_NAMES  = ['Khan','Malik','Sheikh','Butt','Chaudhry','Raza','Iqbal','Ahmad','Hussain','Qureshi'];
const PRODUCT_WORDS = ['Chicken','Beef','Veggie','Chocolate','Vanilla','Spicy','Classic','Deluxe','Family','Mini','Grande','Zinger','Tikka','Karahi','Biryani','Pizza','Burger','Sandwich','Roll','Shake'];

async function batchInsertMulti(conn, table, cols, rows) {
  if (!rows.length) return;
  const colStr = cols.map(c => '`' + c + '`').join(',');
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

async function seed() {
  console.log('Connecting to', DB.host, '/', DB.database);
  const conn = await mariadb.createConnection(DB);
  await conn.query('SET foreign_key_checks = 0');
  await conn.query('SET unique_checks = 0');

  const START = new Date();
  START.setFullYear(START.getFullYear() - 1);
  const END = new Date();

  try {
    // ── Existing state we must respect ──────────────────────────────────────
    const users = await conn.query('SELECT user_id FROM users');
    if (!users.length) throw new Error('No users found — cannot seed created_by/user_id FKs. Create at least one user first.');
    const userIds = users.map(u => u.user_id);

    const [{ nextCatId }]  = await conn.query('SELECT COALESCE(MAX(category_id),0)+1 AS nextCatId FROM categories');
    const [{ nextCustId }] = await conn.query('SELECT COALESCE(MAX(customer_id),0)+1 AS nextCustId FROM customers');
    const [{ existingCustCount }] = await conn.query('SELECT COUNT(*) AS existingCustCount FROM customers');

    // ── 1. categories ────────────────────────────────────────────────────────
    console.log('\n[1/13] categories');
    const catRows = [];
    for (let i = 0; i < TARGET; i++) {
      const id = nextCatId + i;
      catRows.push([`Category ${id}`, pick(CAT_TYPES), null, `Auto-generated test category ${id}`, 1]);
    }
    await batchInsertMulti(conn, 'categories', ['category_name','category_type','parent_id','description','is_active'], catRows);
    const [{ minCat }] = await conn.query('SELECT MIN(category_id) AS minCat FROM categories WHERE category_id >= ?', [nextCatId]);
    const [{ maxCat }] = await conn.query('SELECT MAX(category_id) AS maxCat FROM categories');

    // ── 2. products ──────────────────────────────────────────────────────────
    console.log('\n[2/13] products');
    const [{ nextProdId }] = await conn.query('SELECT COALESCE(MAX(product_id),0)+1 AS nextProdId FROM products');
    const prodRows = [];
    for (let i = 0; i < TARGET; i++) {
      const id = nextProdId + i;
      const cost  = rand(100, 50000) / 100;
      const price = +(cost * (1 + rand(10, 80) / 100)).toFixed(2);
      prodRows.push([
        `${pick(PRODUCT_WORDS)} ${pick(PRODUCT_WORDS)} ${id}`,
        rand(minCat, maxCat),
        pick(CAT_TYPES),
        pick(UNITS),
        price, price, cost,
        rand(0, 5000), rand(5, 50), rand(1, 20), 0,
        `SKU${String(id).padStart(9, '0')}`,
        `BAR${String(id).padStart(10, '0')}`,
        `Auto-generated test product ${id}`,
        1,
        fmtTS(randDate(START, END)),
      ]);
    }
    await batchInsertMulti(conn, 'products',
      ['product_name','category_id','product_type','unit','price','selling_price','cost_price',
       'stock_quantity','reorder_level','min_stock_level','has_variants','sku','barcode','description','is_active','created_at'],
      prodRows);
    const [{ minProd }] = await conn.query('SELECT MIN(product_id) AS minProd FROM products WHERE product_id >= ?', [nextProdId]);
    const [{ maxProd }] = await conn.query('SELECT MAX(product_id) AS maxProd FROM products');

    // ── 3. inventory (1:1 with the new products) ────────────────────────────
    console.log('\n[3/13] inventory');
    const invRows = [];
    for (let pid = minProd; pid <= maxProd; pid++) {
      invRows.push([pid, rand(0, 2000), +(rand(100, 50000) / 100).toFixed(4)]);
    }
    await batchInsertMulti(conn, 'inventory', ['product_id','available_stock','avg_cost'], invRows);

    // ── 4. customers ─────────────────────────────────────────────────────────
    console.log('\n[4/13] customers');
    const custRows = [];
    for (let i = 0; i < TARGET; i++) {
      const id = nextCustId + i;
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      custRows.push([
        name,
        String(9200000000 + id), // distinct prefix — won't collide with real customer numbers
        `customer${id}@example.com`,
        i % 5 === 0 ? `${name} Enterprises` : null,
        +(rand(0, 100000) / 100).toFixed(2),
        +(rand(0, 50000) / 100).toFixed(2),
        fmtTS(randDate(START, END)),
      ]);
    }
    await batchInsertMulti(conn, 'customers',
      ['customer_name','phone_number','email','company','balance','credit_limit','created_at'], custRows);
    const [{ minCust }] = await conn.query('SELECT MIN(customer_id) AS minCust FROM customers WHERE customer_id >= ?', [nextCustId]);
    const [{ maxCust }] = await conn.query('SELECT MAX(customer_id) AS maxCust FROM customers');
    // Pool of customer IDs to reference elsewhere: the walk-in (1, if it exists) + all new customers
    const custPoolMin = existingCustCount > 0 ? 1 : minCust;

    // ── 5. suppliers ─────────────────────────────────────────────────────────
    console.log('\n[5/13] suppliers');
    const [{ nextSupId }] = await conn.query('SELECT COALESCE(MAX(supplier_id),0)+1 AS nextSupId FROM suppliers');
    const supRows = [];
    const TERMS = ['Net 30','Net 60','COD','Advance','Net 15'];
    for (let i = 0; i < TARGET; i++) {
      const id = nextSupId + i;
      supRows.push([
        `Supplier ${id} Traders`,
        `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        `03${String(rand(100000000, 999999999))}`,
        `supplier${id}@example.com`,
        `${rand(1, 999)} Industrial Area, ${pick(CITIES)}`,
        `TAX${String(id).padStart(7, '0')}`,
        pick(TERMS), 1,
      ]);
    }
    await batchInsertMulti(conn, 'suppliers',
      ['supplier_name','contact_person','phone','email','address','tax_id','payment_terms','is_active'], supRows);
    const [{ minSup }] = await conn.query('SELECT MIN(supplier_id) AS minSup FROM suppliers WHERE supplier_id >= ?', [nextSupId]);
    const [{ maxSup }] = await conn.query('SELECT MAX(supplier_id) AS maxSup FROM suppliers');

    // ── 6. sales ─────────────────────────────────────────────────────────────
    console.log('\n[6/13] sales');
    const [{ nextSaleId }] = await conn.query('SELECT COALESCE(MAX(sale_id),0)+1 AS nextSaleId FROM sales');
    const saleRows = [];
    const saleMeta = []; // track {customer_id} per generated sale, same order as insert
    for (let i = 0; i < TARGET; i++) {
      const id = nextSaleId + i;
      const custId = rand(custPoolMin, maxCust);
      const sub  = +(rand(200, 50000) / 100).toFixed(2);
      const disc = +(sub * rand(0, 15) / 100).toFixed(2);
      const tax  = +(sub * rand(0, 17) / 100).toFixed(2);
      const net  = +(sub - disc + tax).toFixed(2);
      const profit = +(net * rand(10, 40) / 100).toFixed(2);
      const sDate = randDate(START, END);
      saleMeta.push({ sale_id: id, customer_id: custId, total: net });
      saleRows.push([
        sub, fmtTS(sDate), sub, disc, 0, 0, net,
        pick(userIds), custId, tax,
        pick(METHODS), 'completed', rand(0, 17), 0, 0,
        `Test sale ${id}`, net,
        `T${String(id).padStart(6, '0')}`,
        `INV-${String(id).padStart(8, '0')}`,
        null, pick(ORDER_TYPES), null, null, 0, null, profit, null, 'not_sent', null, rand(1, 6),
      ]);
    }
    await batchInsertMulti(conn, 'sales',
      ['sub_total','sale_date','total_amount','discount','bundle_discount','bundle_count','net_amount',
       'user_id','customer_id','tax_amount','payment_method','status','tax_percent',
       'additional_charges_percent','additional_charges_amount','note','amount_paid','token_no','invoice_no',
       'table_id','order_type','customer_name','customer_phone','is_synced','synced_at','profit',
       'fbr_invoice_no','fbr_status','fbr_synced_at','covers'],
      saleRows);
    const [{ minSale }] = await conn.query('SELECT MIN(sale_id) AS minSale FROM sales WHERE sale_id >= ?', [nextSaleId]);
    const [{ maxSale }] = await conn.query('SELECT MAX(sale_id) AS maxSale FROM sales');

    // ── 7. sale_details (one line item per new sale) ────────────────────────
    console.log('\n[7/13] sale_details');
    const sdRows = [];
    for (const s of saleMeta) {
      const qty   = rand(1, 6);
      const unitPrice = +(s.total / qty).toFixed(2);
      sdRows.push([
        s.sale_id, rand(minProd, maxProd), null, null,
        qty, unitPrice, 0, s.total, +(s.total * rand(10, 40) / 100).toFixed(2), null,
      ]);
    }
    await batchInsertMulti(conn, 'sale_details',
      ['sale_id','product_id','variant_id','variant_name','quantity','unit_price','discount','total_price','profit','note'], sdRows);

    // ── 8. purchase_orders ───────────────────────────────────────────────────
    console.log('\n[8/13] purchase_orders');
    const [{ nextPoId }] = await conn.query('SELECT COALESCE(MAX(po_id),0)+1 AS nextPoId FROM purchase_orders');
    const poRows = [];
    for (let i = 0; i < TARGET; i++) {
      const id = nextPoId + i;
      const oDate = randDate(START, END);
      const eDate = new Date(oDate); eDate.setDate(eDate.getDate() + rand(3, 30));
      const status = pick(PO_STATUS);
      poRows.push([
        `PO-${String(id).padStart(9, '0')}`,
        rand(minSup, maxSup),
        fmtD(oDate), fmtD(eDate),
        status === 'received' ? fmtD(eDate) : null,
        status,
        +(rand(1000, 500000) / 100).toFixed(2),
        +(rand(0, 5000) / 100).toFixed(2),
        `Test purchase order ${id}`,
        pick(userIds), 1, fmtTS(oDate),
      ]);
    }
    await batchInsertMulti(conn, 'purchase_orders',
      ['po_number','supplier_id','order_date','expected_date','received_date','status',
       'total_amount','additional_charges','notes','created_by','store_id','created_at'], poRows);

    // ── 9. credit_sales (one per new sale, so FK is always valid) ───────────
    console.log('\n[9/13] credit_sales');
    const crRows = [];
    for (const s of saleMeta) {
      const total   = s.total;
      const paid    = +(total * rand(0, 90) / 100).toFixed(2);
      const balance = +(total - paid).toFixed(2);
      const status  = balance <= 0 ? 'paid' : (paid > 0 ? 'partial' : pick(['pending', 'overdue']));
      const dDate   = randDate(new Date(), new Date(new Date().setFullYear(new Date().getFullYear() + 1)));
      crRows.push([
        s.sale_id, s.customer_id, total, paid, balance, balance,
        fmtD(dDate), status, pick(userIds), fmtTS(randDate(START, END)),
      ]);
    }
    await batchInsertMulti(conn, 'credit_sales',
      ['sale_id','customer_id','total_amount','paid_amount','balance','balance_due','due_date','status','created_by','created_at'], crRows);

    // ── 10. quotations ───────────────────────────────────────────────────────
    console.log('\n[10/13] quotations');
    const [{ nextQuoteId }] = await conn.query('SELECT COALESCE(MAX(quotation_id),0)+1 AS nextQuoteId FROM quotations');
    const quoteRows = [];
    for (let i = 0; i < TARGET; i++) {
      const id = nextQuoteId + i;
      const sub = +(rand(500, 100000) / 100).toFixed(2);
      const tax = +(sub * 0.1).toFixed(2);
      const disc = +(sub * rand(0, 10) / 100).toFixed(2);
      const total = +(sub + tax - disc).toFixed(2);
      quoteRows.push([
        `QUO-${String(id).padStart(9, '0')}`,
        rand(custPoolMin, maxCust),
        sub, tax, disc, total,
        pick(QUOTE_STATUS),
        fmtD(randDate(new Date(), new Date(new Date().setMonth(new Date().getMonth() + 3)))),
        `Test quotation ${id}`,
        null, pick(userIds), fmtTS(randDate(START, END)),
      ]);
    }
    await batchInsertMulti(conn, 'quotations',
      ['quotation_number','customer_id','subtotal','tax_amount','discount','total_amount','status','valid_until','notes','converted_sale_id','created_by','created_at'], quoteRows);

    // ── 11. deliveries ───────────────────────────────────────────────────────
    console.log('\n[11/13] deliveries');
    const [{ nextDelId }] = await conn.query('SELECT COALESCE(MAX(delivery_id),0)+1 AS nextDelId FROM deliveries');
    const delRows = [];
    for (let i = 0; i < TARGET; i++) {
      const id = nextDelId + i;
      const s = saleMeta[i % saleMeta.length];
      delRows.push([
        `DEL-${String(id).padStart(9, '0')}`,
        s.sale_id, s.customer_id,
        `${rand(1, 999)} Street ${rand(1, 99)}, ${pick(CITIES)}`,
        pick(CITIES),
        String(9300000000 + id),
        `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        String(9400000000 + id),
        pick(DEL_STATUS),
        +(rand(0, 5000) / 100).toFixed(2),
        fmtD(randDate(START, END)),
        null,
        `Test delivery ${id}`,
        pick(userIds), fmtTS(randDate(START, END)),
      ]);
    }
    await batchInsertMulti(conn, 'deliveries',
      ['delivery_number','sale_id','customer_id','delivery_address','delivery_city','delivery_phone',
       'rider_name','rider_phone','status','delivery_charges','estimated_delivery','actual_delivery',
       'notes','created_by','created_at'], delRows);

    // ── 12. returns ──────────────────────────────────────────────────────────
    console.log('\n[12/13] returns');
    const retRows = [];
    for (let i = 0; i < TARGET; i++) {
      const s = saleMeta[i % saleMeta.length];
      retRows.push([
        s.sale_id, fmtTS(randDate(START, END)),
        +(s.total * rand(10, 100) / 100).toFixed(2),
        `Test return reason ${i + 1}`,
        pick(userIds),
      ]);
    }
    await batchInsertMulti(conn, 'returns', ['sale_id','return_date','refund_amount','reason','user_id'], retRows);

    // ── 13. stock_adjustments ────────────────────────────────────────────────
    console.log('\n[13/13] stock_adjustments');
    const saRows = [];
    for (let i = 0; i < TARGET; i++) {
      const qBefore = rand(0, 3000);
      const qAdj = rand(1, 300);
      const type = pick(ADJ_TYPES);
      const qAfter = ['addition','return','opening_stock'].includes(type) ? qBefore + qAdj : Math.max(0, qBefore - qAdj);
      saRows.push([
        rand(minProd, maxProd), null, type, qBefore, qAdj, qAfter,
        `Test adjustment ${i + 1}`, `REF-${i + 1}`, pick(userIds), fmtTS(randDate(START, END)),
      ]);
    }
    await batchInsertMulti(conn, 'stock_adjustments',
      ['product_id','variant_id','adjustment_type','quantity_before','quantity_adjusted','quantity_after','reason','reference_number','created_by','created_at'], saRows);

    // ── Done ─────────────────────────────────────────────────────────────────
    console.log('\n✓ Seed complete!\n');
    const tables = ['categories','products','inventory','customers','suppliers','sales','sale_details','purchase_orders','credit_sales','quotations','deliveries','returns','stock_adjustments'];
    for (const t of tables) {
      const [{ cnt }] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
      console.log(`  ${t.padEnd(20)} ${Number(cnt).toLocaleString().padStart(10)} rows`);
    }
  } finally {
    await conn.query('SET foreign_key_checks = 1');
    await conn.query('SET unique_checks = 1');
    await conn.end();
  }
}

seed().catch(e => { console.error('\nSeed failed:', e.message); process.exit(1); });
