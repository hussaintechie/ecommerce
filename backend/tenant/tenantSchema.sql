CREATE TABLE tbl_address (
    address_id      SERIAL PRIMARY KEY,
    user_id       UNIQUE  INT NOT NULL,
    store_id        INTEGER,
    name            VARCHAR(100),
    phone           VARCHAR(15),

    state           VARCHAR(100),
    city            VARCHAR(100),
    district        VARCHAR(100),
    street          VARCHAR(255),
    landmark        VARCHAR(255),

    pincode         VARCHAR(10),
    address_type    VARCHAR(50),
    lat             DECIMAL(10,6),
    lng             DECIMAL(10,6),
    is_default BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tbl_master_categories (
    categories_id SERIAL PRIMARY KEY,
    categories_name VARCHAR(255),
    cat_sts INT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tbl_master_product (
    product_id SERIAL PRIMARY KEY,
    categories_id INT,
    title VARCHAR(255),
    description TEXT,
    price NUMERIC(10,2),
    mrp NUMERIC(10,2),
    quantity INT,
    unit INT,
    lowstqty INTEGER DEFAULT 0,
    thumbnail TEXT,
    discount_per NUMERIC(5,2) DEFAULT 0,
    discount_sts SMALLINT DEFAULT 0,
    itm_spctyp VARCHAR(255) DEFAULT NUll,
    lowstqty INTEGER DEFAULT 0,
    itmsts INTEGER DEFAULT 1,
    openbalqty INTEGER DEFAULT 0,
    COLUMN itm_spctyp VARCHAR(255),
    openbaldate DATE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS unitofmeasure_master (
    unitid SERIAL PRIMARY KEY,
    unitshortcode VARCHAR(10),
    unitname VARCHAR(100),
    isbaseunit NUMERIC(11,2),
    baseunitid INT DEFAULT 0,
    decimalbasefactor INT,
    added_userid INT,
    added_date TIMESTAMP DEFAULT NOW(),
    modify_userid INT,
    modified_date TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tmp_tbl_master_product (
    trnid SERIAL PRIMARY KEY,
    categoriesname VARCHAR(255),
    title VARCHAR(255),
    description TEXT,
    price NUMERIC(10,2),
    mrp NUMERIC(10,2),
    quantity INT,
    unit VARCHAR(50),
	product_status BOOLEAN,
	stock int
);
CREATE TABLE IF NOT EXISTS tbl_master_orders (
    order_id SERIAL PRIMARY KEY,
    order_no VARCHAR(20) DEFAULT '',
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    address_delivery TEXT,
    total_amount NUMERIC(10,2) NOT NULL,
    order_status VARCHAR(20) DEFAULT 'new',
    delivery_id INT,
    payment_status VARCHAR(10) DEFAULT 'pending',
   coupon_code VARCHAR(50),
   delivery_start TYPE timestamptz,
   delivery_end TYPE timestamptz,
   coupon_discount NUMERIC(10,2) DEFAULT 0,
   first_order_discount NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tbl_master_payment (
    payment_id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    method VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order
      FOREIGN KEY (order_id) REFERENCES tbl_master_orders(order_id)
      ON DELETE CASCADE
);
CREATE TABLE tbl_cart (
    cart_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,        -- master DB user
    product_id INT NOT NULL,     -- optional FK
    quantity INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);          

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON tbl_cart
FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();


CREATE TABLE IF NOT EXISTS tbl_delivery_modes (
    delivery_id SERIAL PRIMARY KEY,
    delivery_mode VARCHAR(50) NOT NULL
);
INSERT INTO tbl_delivery_modes (delivery_mode) VALUES
('Cash on Delivery'),
('Online Payment'),
('Card / Swipe'),
('UPI Payment');
CREATE TABLE IF NOT EXISTS tbl_product_images (
    image_id SERIAL PRIMARY KEY,
    product_id INT REFERENCES tbl_master_product(product_id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

create table tbl_favorites (
fav_id serial primary key,
user_id int not null,
product_id int not null,
created_at timestamp default now(),
unique(user_id,product_id)

);
CREATE TABLE IF NOT EXISTS tbl_rollno_master (
    rollid SERIAL PRIMARY KEY,
    prefix VARCHAR(50) NOT NULL,
    lastrollid INT,
    nodigit INT 
);
insert into tbl_rollno_master(prefix ,lastrollid,nodigit) values ('ORD' ,1 ,4);

create table IF NOT EXISTS tbl_master_order_items (
    ord_trnid SERIAL PRIMARY KEY,
	order_id INT NOT NULL,
    product_id INT NOT NULL,
	product_name VARCHAR(255),
    product_unit INT NOT NULL,
    product_qty INT NOT NULL,
    product_rate NUMERIC(10,2) NOT NULL,
    product_amount NUMERIC(10,2) NOT NULL,
    discount_amt NUMERIC(10,2) NOT NULL,
    discount_per NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);





CREATE TABLE tbl_order_tracking (
  id SERIAL PRIMARY KEY,
  order_id INT,
  status VARCHAR(30),
  created_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE tbl_coupons (
  coupon_id SERIAL PRIMARY KEY,
  coupon_code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(10) CHECK (discount_type IN ('PERCENT','FLAT')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_value NUMERIC(10,2) DEFAULT 0,
  max_discount NUMERIC(10,2),
  expiry_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE tbl_coupon_usage (
  usage_id SERIAL PRIMARY KEY,
  coupon_id INT REFERENCES tbl_coupons(coupon_id),
  user_id INT,
  order_id INT,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (coupon_id, user_id)
);



CREATE TABLE tbl_delivery_partner (
  driver_id SERIAL PRIMARY KEY,
  full_name VARCHAR(150),
  mobile VARCHAR(15),
  aadhar_no VARCHAR(20),
  address TEXT,
  status SMALLINT DEFAULT 1, -- 1 = active, 0 = inactive
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE tbl_customer_review (
  review_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  tags TEXT[],
  comment TEXT,
  is_reviewed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE if not exists stock_transaction (
    stocktrnid SERIAL PRIMARY KEY,
    purchase_id INTEGER NOT NULL,
    orderid INTEGER DEFAULT 0,
    purchase_date DATE NOT NULL,
    instoreid INTEGER DEFAULT 0,
    outstoreid INTEGER DEFAULT 0,
    itmid INTEGER NOT NULL,
    itmname VARCHAR(250),
    unitid INTEGER DEFAULT 0,
    stockqty INTEGER DEFAULT 0,
    rate NUMERIC(10,2) DEFAULT 0,
    value NUMERIC(10,2) DEFAULT 0,
    currentstock INTEGER DEFAULT 0,
    itmcandel INTEGER DEFAULT 0,
    canordersts INTEGER DEFAULT 0
);
CREATE TABLE tbl_delivery_otp (
  otp_id SERIAL PRIMARY KEY,
  order_id INT NOT NULL,
  phone VARCHAR(15) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  otp_expiry TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX idx_stock_transaction_itmid_date
ON stock_transaction(itmid, purchase_date);

CREATE INDEX idx_product_category
ON tbl_master_product(categories_id);