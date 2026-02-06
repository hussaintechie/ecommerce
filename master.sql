--
-- PostgreSQL database dump
--

\restrict cjrvJYddOXYYI1pqZAV5YaMxsvLWEtNWNLrC74Y8RUGUZC4B7i1ueqk3NDTR97o

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-01-02 20:08:20

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 222 (class 1259 OID 17484)
-- Name: tbl_login; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tbl_login (
    user_id integer NOT NULL,
    register_id integer,
    otp character varying(6),
    user_role character varying(10) DEFAULT 'user'::character varying NOT NULL,
    is_first_login boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    added_by character varying(26) DEFAULT USER,
    phone character varying(26),
    CONSTRAINT tbl_login_user_role_check CHECK (((user_role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying])::text[])))
);


ALTER TABLE public.tbl_login OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 17483)
-- Name: tbl_login_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tbl_login_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tbl_login_user_id_seq OWNER TO postgres;

--
-- TOC entry 5049 (class 0 OID 0)
-- Dependencies: 221
-- Name: tbl_login_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tbl_login_user_id_seq OWNED BY public.tbl_login.user_id;


--
-- TOC entry 220 (class 1259 OID 17466)
-- Name: tbl_register; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tbl_register (
    register_id integer NOT NULL,
    phone character varying(15) NOT NULL,
    store_name character varying(255) NOT NULL,
    email_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tbl_register OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 17465)
-- Name: tbl_register_register_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tbl_register_register_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tbl_register_register_id_seq OWNER TO postgres;

--
-- TOC entry 5050 (class 0 OID 0)
-- Dependencies: 219
-- Name: tbl_register_register_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tbl_register_register_id_seq OWNED BY public.tbl_register.register_id;


--
-- TOC entry 224 (class 1259 OID 17507)
-- Name: tbl_tenant_databases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tbl_tenant_databases (
    tenant_id integer NOT NULL,
    register_id integer,
    db_name character varying(255),
    db_host character varying(255) DEFAULT 'localhost'::character varying,
    db_user character varying(255),
    db_pass character varying(255),
    port integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tbl_tenant_databases OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 17506)
-- Name: tbl_tenant_databases_tenant_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tbl_tenant_databases_tenant_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tbl_tenant_databases_tenant_id_seq OWNER TO postgres;

--
-- TOC entry 5051 (class 0 OID 0)
-- Dependencies: 223
-- Name: tbl_tenant_databases_tenant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tbl_tenant_databases_tenant_id_seq OWNED BY public.tbl_tenant_databases.tenant_id;


--
-- TOC entry 4868 (class 2604 OID 17487)
-- Name: tbl_login user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_login ALTER COLUMN user_id SET DEFAULT nextval('public.tbl_login_user_id_seq'::regclass);


--
-- TOC entry 4866 (class 2604 OID 17469)
-- Name: tbl_register register_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_register ALTER COLUMN register_id SET DEFAULT nextval('public.tbl_register_register_id_seq'::regclass);


--
-- TOC entry 4873 (class 2604 OID 17510)
-- Name: tbl_tenant_databases tenant_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_tenant_databases ALTER COLUMN tenant_id SET DEFAULT nextval('public.tbl_tenant_databases_tenant_id_seq'::regclass);


--
-- TOC entry 5041 (class 0 OID 17484)
-- Dependencies: 222
-- Data for Name: tbl_login; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tbl_login (user_id, register_id, otp, user_role, is_first_login, created_at, added_by, phone) FROM stdin;
4	2	\N	user	t	2025-12-03 23:22:06.045434	postgres	\N
3	2	\N	admin	t	2025-12-03 23:21:40.234743	postgres	\N
9	2	814298	user	t	2025-12-06 19:37:04.814713	postgres	7871995823
\.


--
-- TOC entry 5039 (class 0 OID 17466)
-- Dependencies: 220
-- Data for Name: tbl_register; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tbl_register (register_id, phone, store_name, email_id, created_at) FROM stdin;
2	7871995823	hussain	rajhussain1042003@gmail	2025-12-03 23:21:40.231769
\.


--
-- TOC entry 5043 (class 0 OID 17507)
-- Dependencies: 224
-- Data for Name: tbl_tenant_databases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tbl_tenant_databases (tenant_id, register_id, db_name, db_host, db_user, db_pass, port, created_at) FROM stdin;
2	2	hussain	localhost	postgres	root	5432	2025-12-03 23:21:40.539709
\.


--
-- TOC entry 5052 (class 0 OID 0)
-- Dependencies: 221
-- Name: tbl_login_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tbl_login_user_id_seq', 9, true);


--
-- TOC entry 5053 (class 0 OID 0)
-- Dependencies: 219
-- Name: tbl_register_register_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tbl_register_register_id_seq', 2, true);


--
-- TOC entry 5054 (class 0 OID 0)
-- Dependencies: 223
-- Name: tbl_tenant_databases_tenant_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tbl_tenant_databases_tenant_id_seq', 2, true);


--
-- TOC entry 4884 (class 2606 OID 17498)
-- Name: tbl_login tbl_login_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_login
    ADD CONSTRAINT tbl_login_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4878 (class 2606 OID 17482)
-- Name: tbl_register tbl_register_email_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_register
    ADD CONSTRAINT tbl_register_email_id_key UNIQUE (email_id);


--
-- TOC entry 4880 (class 2606 OID 17480)
-- Name: tbl_register tbl_register_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_register
    ADD CONSTRAINT tbl_register_phone_key UNIQUE (phone);


--
-- TOC entry 4882 (class 2606 OID 17478)
-- Name: tbl_register tbl_register_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_register
    ADD CONSTRAINT tbl_register_pkey PRIMARY KEY (register_id);


--
-- TOC entry 4886 (class 2606 OID 17519)
-- Name: tbl_tenant_databases tbl_tenant_databases_db_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_tenant_databases
    ADD CONSTRAINT tbl_tenant_databases_db_name_key UNIQUE (db_name);


--
-- TOC entry 4888 (class 2606 OID 17517)
-- Name: tbl_tenant_databases tbl_tenant_databases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_tenant_databases
    ADD CONSTRAINT tbl_tenant_databases_pkey PRIMARY KEY (tenant_id);


--
-- TOC entry 4889 (class 2606 OID 17501)
-- Name: tbl_login fk_login_register; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_login
    ADD CONSTRAINT fk_login_register FOREIGN KEY (register_id) REFERENCES public.tbl_register(register_id) ON DELETE CASCADE;


--
-- TOC entry 4890 (class 2606 OID 17520)
-- Name: tbl_tenant_databases tbl_tenant_databases_register_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_tenant_databases
    ADD CONSTRAINT tbl_tenant_databases_register_id_fkey FOREIGN KEY (register_id) REFERENCES public.tbl_register(register_id);


-- Completed on 2026-01-02 20:08:20

--
-- PostgreSQL database dump complete
--

\unrestrict cjrvJYddOXYYI1pqZAV5YaMxsvLWEtNWNLrC74Y8RUGUZC4B7i1ueqk3NDTR97o

