CREATE TABLE IF NOT EXISTS tbl_address (
    address_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(15),
    address TEXT,
    state VARCHAR(100),
    city VARCHAR(100),
    pincode VARCHAR(10),
    type VARCHAR(20),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS tbl_master_categories (
    categories_id SERIAL PRIMARY KEY,
    categories_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tbl_master_product (
    product_id SERIAL PRIMARY KEY,
    categories_id INT,
    title VARCHAR(255),
    description TEXT,
    price NUMERIC(10,2),
    mrp NUMERIC(10,2),
    quantity INT,
    thumbnail TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tbl_master_orders (
    order_id SERIAL PRIMARY KEY,
    user_id INT,
    address_delivery INT,
    total_amount NUMERIC(10,2),
    order_status VARCHAR(50),
    payment_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);
