CREATE TABLE tbl_address (
    address_id      SERIAL PRIMARY KEY,
    user_id         INT NOT NULL,
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
    thumbnail TEXT,
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
    unit VARCHAR(50)
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
