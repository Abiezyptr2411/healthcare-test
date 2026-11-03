# Healthcare Scheduling System

Sistem manajemen jadwal konsultasi klinik berbasis **Microservices** yang dibangun menggunakan **NestJS**, **GraphQL (Code-First Apollo Driver)**, **Prisma ORM**, **PostgreSQL**, **Redis**, dan **Docker Compose**.

Sistem ini memisahkan fungsionalitas ke dalam dua microservice independen:
1. **Auth Service (Port 3001)** — Registrasi, login, penerbitan JWT, dan validasi token.
2. **Schedule Service (Port 3002)** — Manajemen Customer, Doctor, dan Schedule, terlindungi oleh autentikasi.

> **Catatan Arsitektur Notification**: Email worker (BullMQ + Nodemailer) disatukan di dalam `schedule-service` sebagai sebuah modul (`NotificationModule`), bukan container terpisah. Keputusan ini diambil karena email notification adalah side-effect langsung dari operasi schedule (bukan domain bisnis tersendiri), sehingga menyatukannya lebih sederhana, mengurangi latensi antar-service, dan menghindari overhead orkestrasi container tambahan untuk satu kegunaan. Container pendukung yang ditambahkan di docker-compose adalah **Redis** (queue + cache) dan **Mailpit** (mock SMTP).

---

## Daftar Isi

1. [Cara Menjalankan Project](#1-cara-menjalankan-project)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Environment Variables](#3-environment-variables)
4. [Contoh GraphQL Queries & Mutations](#4-contoh-graphql-queries--mutations)
5. [Keputusan Desain & Asumsi](#5-keputusan-desain--asumsi)
6. [Unit Testing & Coverage](#6-unit-testing--coverage)

---

## 1. Cara Menjalankan Project

### Prasyarat
- **Docker** dan **Docker Compose** terpasang dan berjalan.

### Langkah-langkah

**1. Clone repository dan masuk ke folder project:**
```bash
git clone <url-repo>
cd healthcare-scheduling
```

**2. Salin file environment dari template:**
```bash
cp .env.example .env
```
Isi nilai `JWT_SECRET` di file `.env` dengan string acak yang kuat (minimal 32 karakter) sebelum menjalankan sistem.

**3. Jalankan seluruh sistem dengan satu perintah:**
```bash
docker-compose up --build
```

> Opsional: Tambahkan flag `-d` untuk menjalankan di background: `docker-compose up --build -d`

**Apa yang terjadi secara otomatis saat startup:**
1. **PostgreSQL** menyala dan menjalankan `docker/postgres/init.sql` untuk membuat `auth_db` dan `schedule_db`.
2. **Redis** menyala untuk caching query dan antrean email BullMQ.
3. **Mailpit** menyala sebagai server SMTP lokal untuk menangkap email.
4. **auth-service** menunggu PostgreSQL healthy, lalu menjalankan `prisma migrate deploy`, kemudian server aktif.
5. **schedule-service** menunggu PostgreSQL, Redis, dan auth-service siap, lalu menjalankan `prisma migrate deploy`, kemudian server aktif.

**4. Akses layanan yang telah berjalan:**

| Layanan | URL | Keterangan |
| :--- | :--- | :--- |
| Auth Service GraphQL Sandbox | http://localhost:3001/graphql | Register, Login, ValidateToken |
| Schedule Service GraphQL Sandbox | http://localhost:3002/graphql | Customer, Doctor, Schedule CRUD |
| Mailpit Web Dashboard | http://localhost:8025 | Inbox email notifikasi |
| PostgreSQL | localhost:5432 | DB Server (`auth_db` & `schedule_db`) |
| Redis | localhost:6379 | Cache & BullMQ |

**5. Menghentikan sistem:**
```bash
docker-compose down
```
Untuk menghapus data volume juga (reset penuh):
```bash
docker-compose down -v
```

---

## 2. Arsitektur Sistem

### Diagram Arsitektur (Mermaid)

```mermaid
flowchart TD
    Client["Client\n(Browser / Postman)"]

    subgraph Network["Docker Bridge Network: healthcare-net"]
        subgraph AuthSvc["auth-service :3001"]
            A1["GraphQL Resolver"]
            A2["AuthService\n(bcrypt + JWT)"]
            A3["Prisma ORM"]
            A1 --> A2 --> A3
        end

        subgraph ScheduleSvc["schedule-service :3002"]
            S1["Global AuthGuard"]
            S2["GraphQL Resolvers\n(Customer, Doctor, Schedule)"]
            S3["Business Services"]
            S4["Prisma ORM"]
            S5["RedisCacheService"]
            S6["NotificationModule\n(BullMQ Worker + Nodemailer)"]
            S1 --> S2 --> S3
            S3 --> S4
            S3 --> S5
            S3 --> S6
        end

        PG[("PostgreSQL 16\nauth_db | schedule_db")]
        RD[("Redis 7\nCache + BullMQ Queue")]
        MP["Mailpit\nSMTP :1025 | UI :8025"]
    end

    Client -->|"register / login"| A1
    Client -->|"GraphQL + Bearer token"| S1
    S1 -.->|"HTTP validateToken"| A1
    A3 --> PG
    S4 --> PG
    S5 <--> RD
    S6 <--> RD
    S6 -->|"SMTP"| MP
```

### Diagram ASCII

```
+------------------------------------------------------------------+
|               CLIENT (Browser / Apollo Sandbox / Postman)        |
+------------------------------------------------------------------+
        |                                       |
        | 1. register / login                   | 2. Bearer <token>
        | <- accessToken                        |
        v                                       v
+---------------------+       HTTP       +----------------------------+
|  AUTH SERVICE :3001 | <-- validate --> |  SCHEDULE SERVICE :3002    |
|---------------------|  validateToken   |----------------------------|
| - register          |                 | - Global AuthGuard          |
| - login             |                 | - Customer CRUD + Pagination|
| - validateToken     |                 | - Doctor CRUD + Pagination  |
| - bcrypt + JWT      |                 | - Schedule + Filter + Paging|
| - Prisma (auth_db)  |                 | - Conflict prevention       |
+---------------------+                 | - BullMQ email queue        |
        |                               | - Redis cache + fallback    |
        |                               +----------------------------+
        |                                       |       |       |
        v                                       v       v       v
  +------------+                         +-------+  +--------+  +-------+
  | PostgreSQL |<----------------------->| Redis |  |Mailpit |  | Redis |
  | auth_db    |   schedule_db           | Cache |  |SMTP    |  | Queue |
  +------------+                         +-------+  +--------+  +-------+
```

### Alur Autentikasi Antar-Service

1. Client mengirim `login` ke Auth Service → mendapat `accessToken` (JWT).
2. Client menyertakan header `Authorization: Bearer <token>` ke setiap request di Schedule Service.
3. `AuthGuard` global di Schedule Service membaca token, lalu memanggil `validateToken` ke Auth Service via HTTP GraphQL.
4. Jika valid → Auth Service merespons `{ id, email }` → request dilanjutkan.
5. Jika tidak valid / expired / tidak ada header → langsung `401 UnauthorizedException`.

---

## 3. Environment Variables

Semua konfigurasi dikelola melalui file `.env` di root project. Salin dari `.env.example` untuk memulai.

> **Penting**: Jangan commit file `.env` ke repository. File ini sudah terdaftar di `.gitignore`.

| Nama Variabel | Contoh Nilai | Keterangan |
| :--- | :--- | :--- |
| `POSTGRES_USER` | `postgres` | Username superuser PostgreSQL |
| `POSTGRES_PASSWORD` | `postgres` | Password superuser PostgreSQL (ganti di production) |
| `POSTGRES_PORT` | `5432` | Port PostgreSQL yang diekspos ke host |
| `AUTH_SERVICE_PORT` | `3001` | Port HTTP Auth Service |
| `AUTH_DATABASE_URL` | `postgresql://postgres:postgres@postgres:5432/auth_db?schema=public` | Connection string ke `auth_db` (hostname `postgres` merujuk ke container) |
| `JWT_SECRET` | *(wajib diisi, min. 32 karakter)* | Kunci rahasia untuk signing JWT — **tidak boleh kosong** |
| `JWT_EXPIRES_IN` | `1h` | Masa berlaku JWT (contoh: `1h`, `7d`, `30m`) |
| `SCHEDULE_SERVICE_PORT` | `3002` | Port HTTP Schedule Service |
| `SCHEDULE_DATABASE_URL` | `postgresql://postgres:postgres@postgres:5432/schedule_db?schema=public` | Connection string ke `schedule_db` |
| `AUTH_SERVICE_URL` | `http://auth-service:3001/graphql` | URL internal Auth Service di dalam docker network |
| `REDIS_HOST` | `redis` | Hostname Redis di dalam docker network |
| `REDIS_PORT` | `6379` | Port Redis (host mapping) |
| `MAIL_HOST` | `mailpit` | Hostname SMTP server di dalam docker network |
| `MAIL_PORT` | `1025` | Port SMTP Mailpit |
| `MAIL_UI_PORT` | `8025` | Port Web Dashboard Mailpit (browser) |
| `MAIL_FROM` | `"Healthcare System <noreply@healthcare.local>"` | Alamat pengirim email notifikasi |

---

## 4. Contoh GraphQL Queries & Mutations

### A. Auth Service — `http://localhost:3001/graphql`

#### Register User Baru
```graphql
mutation RegisterUser {
  register(input: {
    email: "admin@healthcare.local"
    password: "Password123!"
  }) {
    accessToken
    user {
      id
      email
      createdAt
    }
  }
}
```

#### Login User
```graphql
mutation LoginUser {
  login(input: {
    email: "admin@healthcare.local"
    password: "Password123!"
  }) {
    accessToken
    user {
      id
      email
    }
  }
}
```

#### Validasi Token (dipanggil otomatis oleh Schedule Service)
```graphql
query ValidateToken {
  validateToken(token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...") {
    id
    email
  }
}
```

---

### B. Schedule Service — `http://localhost:3002/graphql`

> Semua endpoint di Schedule Service **wajib menyertakan header**:
> ```json
> { "Authorization": "Bearer <accessToken>" }
> ```
> Di Apollo Sandbox: isi di tab **Headers** bagian bawah editor.

---

#### Customer — Buat Customer
```graphql
mutation CreateCustomer {
  createCustomer(input: {
    name: "Budi Santoso"
    email: "budi@pasien.com"
  }) {
    id
    name
    email
    createdAt
  }
}
```

#### Customer — Update Customer
```graphql
mutation UpdateCustomer {
  updateCustomer(input: {
    id: "CUSTOMER_UUID"
    name: "Budi Santoso, S.T"
  }) {
    id
    name
    email
    updatedAt
  }
}
```

#### Customer — Daftar Customer (dengan Pagination)
```graphql
query GetCustomers {
  customers(page: 1, limit: 10) {
    items {
      id
      name
      email
    }
    meta {
      total
      page
      limit
      totalPages
    }
  }
}
```

#### Customer — Detail Customer by ID
```graphql
query GetCustomer {
  customer(id: "CUSTOMER_UUID") {
    id
    name
    email
    createdAt
    updatedAt
  }
}
```

#### Customer — Hapus Customer
> Ditolak jika customer masih memiliki schedule aktif (`400 BadRequestException`).
```graphql
mutation DeleteCustomer {
  deleteCustomer(id: "CUSTOMER_UUID") {
    id
    name
    email
  }
}
```

---

#### Doctor — Buat Doctor
```graphql
mutation CreateDoctor {
  createDoctor(input: {
    name: "dr. Tirta Mandira Hudhi, Sp.JP"
  }) {
    id
    name
    createdAt
  }
}
```

#### Doctor — Update Doctor
```graphql
mutation UpdateDoctor {
  updateDoctor(input: {
    id: "DOCTOR_UUID"
    name: "dr. Tirta Mandira Hudhi, Sp.JP, M.Kes"
  }) {
    id
    name
    updatedAt
  }
}
```

#### Doctor — Daftar Doctor (dengan Pagination)
```graphql
query GetDoctors {
  doctors(page: 1, limit: 10) {
    items {
      id
      name
      createdAt
    }
    meta {
      total
      page
      limit
      totalPages
    }
  }
}
```

#### Doctor — Detail Doctor by ID
```graphql
query GetDoctor {
  doctor(id: "DOCTOR_UUID") {
    id
    name
    createdAt
    updatedAt
  }
}
```

#### Doctor — Hapus Doctor
> Ditolak jika dokter masih memiliki schedule aktif (`400 BadRequestException`).
```graphql
mutation DeleteDoctor {
  deleteDoctor(id: "DOCTOR_UUID") {
    id
    name
  }
}
```

---

#### Schedule — Buat Jadwal Konsultasi
> Validasi: customer & doctor harus ada di DB. Dokter tidak boleh double-booking di waktu yang sama (`409 ConflictException`). Email konfirmasi otomatis dikirim ke customer via BullMQ + Mailpit.
```graphql
mutation CreateSchedule {
  createSchedule(input: {
    objective: "Pemeriksaan Jantung dan EKG Rutin"
    customerId: "CUSTOMER_UUID"
    doctorId: "DOCTOR_UUID"
    scheduledAt: "2026-11-20T10:00:00.000Z"
  }) {
    id
    objective
    scheduledAt
    customer {
      name
      email
    }
    doctor {
      name
    }
    createdAt
  }
}
```

#### Schedule — Daftar Jadwal (Filter + Pagination)
> Filter opsional: `doctorId`, `customerId`, `dateFrom`, `dateTo`. Semua bisa dikombinasikan.
```graphql
query GetSchedules {
  schedules(
    doctorId: "DOCTOR_UUID"
    customerId: "CUSTOMER_UUID"
    dateFrom: "2026-11-01T00:00:00.000Z"
    dateTo: "2026-11-30T23:59:59.000Z"
    page: 1
    limit: 10
  ) {
    items {
      id
      objective
      scheduledAt
      customer {
        name
        email
      }
      doctor {
        name
      }
    }
    meta {
      total
      page
      limit
      totalPages
    }
  }
}
```

#### Schedule — Detail Jadwal by ID
```graphql
query GetSchedule {
  schedule(id: "SCHEDULE_UUID") {
    id
    objective
    scheduledAt
    customer {
      name
      email
    }
    doctor {
      name
    }
    createdAt
    updatedAt
  }
}
```

#### Schedule — Batalkan / Hapus Jadwal
> Email pemberitahuan pembatalan otomatis dikirim ke customer via BullMQ + Mailpit.
```graphql
mutation DeleteSchedule {
  deleteSchedule(id: "SCHEDULE_UUID") {
    id
    objective
    scheduledAt
    customer {
      name
      email
    }
  }
}
```

---

## 5. Keputusan Desain & Asumsi

### Database-per-Service
Satu container PostgreSQL dengan dua database terpisah (`auth_db` dan `schedule_db`). Setiap service hanya memiliki kredensial ke databasenya sendiri, menjaga isolasi data sesuai prinsip microservices.

### Pencegahan Bentrok Jadwal (Double Booking Prevention)
Diterapkan dua lapis pengamanan (*defense-in-depth*):
- **Lapis Aplikasi**: `ScheduleService.createSchedule` mengecek dokter + waktu yang sama sebelum menyimpan. Melempar `ConflictException` jika sudah ada.
- **Lapis Database**: Constraint `@@unique([doctorId, scheduledAt])` pada tabel `schedules`. Menangani *race condition* bila dua request tiba bersamaan dalam milidetik yang sama, serta mengembalikan `ConflictException` jika Prisma mengembalikan error `P2002`.

### Kebijakan Delete Customer & Doctor (Restrict)
Dipilih strategi **Restrict**: penghapusan ditolak (`400 BadRequestException`) jika masih ada schedule aktif yang terkait. *Alasan*: Pada sistem klinik, riwayat konsultasi tidak boleh hilang secara cascade demi integritas audit medis dan histori pasien.

### Email Notification Worker (Inline di Schedule Service)
Email worker (BullMQ + Nodemailer) diintegrasikan sebagai `NotificationModule` di dalam `schedule-service`, bukan container terpisah. *Alasan*: Notifikasi adalah side-effect langsung operasi schedule, bukan domain bisnis mandiri. Pendekatan ini mengurangi kompleksitas orkestrasi Docker dan latensi komunikasi antar-container.

### Redis Caching dengan Graceful Fallback
Query listing (`customers`, `doctors`, `schedules`) dicache di Redis selama 60 detik. Setiap mutasi (create/update/delete) menginvalidasi cache terkait. Jika Redis tidak tersedia, aplikasi tetap berjalan normal dengan membaca langsung dari PostgreSQL.

### JWT Secret Wajib dari Environment
Fallback hard-coded untuk `JWT_SECRET` sengaja dihapus dari `docker-compose.yml`. Nilai ini **wajib diisi** di file `.env`, sehingga tidak ada credentials yang ter-commit ke repository dan reviewer/deployment tidak bisa berjalan dengan secret default yang tidak aman.

---

## 6. Unit Testing & Coverage

Semua unit test ditulis dengan **Jest**, menggunakan mock untuk Prisma, Redis, dan external service.

### Menjalankan Tests Auth Service
```bash
cd auth-service
npm test -- --coverage
```
**Hasil**: 14 tests passed | 2 test suites | **87.8% statement coverage**
- `AuthService`: 100% statements, 100% functions, 100% lines
- `AuthResolver`: Covered dengan mock service

### Menjalankan Tests Schedule Service
```bash
cd schedule-service
npm test -- --coverage
```
**Hasil**: 59 tests passed | 7 test suites | **70.81% statement coverage**
- `CustomerService`: 100% statements & lines
- `DoctorService`: 100% statements & lines
- `ScheduleService`: 95.31% statements
- `AuthGuard`: 93.02% statements

### Cakupan Tests
- `auth-service`: `AuthService`, `AuthResolver`
- `schedule-service`: `CustomerService`, `CustomerResolver`, `DoctorService`, `DoctorResolver`, `ScheduleService`, `ScheduleResolver`, `AuthGuard`

---

## 7. File Pendukung Testing

- **Contoh GraphQL Lengkap + cURL**: [`graphql-examples.md`](./graphql-examples.md)
- **Postman Collection**: [`healthcare-scheduling.postman_collection.json`](./healthcare-scheduling.postman_collection.json) — import ke Postman untuk langsung mencoba semua endpoint. Token login otomatis tersimpan ke variabel koleksi.
