# Healthcare Scheduling System

Sistem manajemen jadwal konsultasi klinik berbasis **Microservices** yang dibangun menggunakan **NestJS**, **GraphQL (Code-First Apollo Driver)**, **Prisma ORM**, **PostgreSQL**, **Redis**, dan **Docker Compose**.

Sistem ini memisahkan fungsionalitas ke dalam dua microservice independen yang berkomunikasi melalui API:

1. **Auth Service (Port 3001)**: Menangani registrasi, otentikasi login, penerbitan JWT token, dan validasi token.
2. **Schedule Service (Port 3002)**: Menangani manajemen Customer (Pasien), Doctor (Dokter), dan Jadwal Konsultasi (Schedule) yang terlindungi otentikasi.

---

## 📑 Daftar Isi

1. [Cara Menjalankan Project](#1-cara-menjalankan-project)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [List Environment Variables](#3-list-environment-variables)
4. [Contoh GraphQL Queries & Mutations](#4-contoh-graphql-queries--mutations)
5. [Keputusan Desain & Asumsi](#5-keputusan-desain--asumsi)
6. [Unit Testing & Code Coverage](#6-unit-testing--code-coverage)

---

## 1. Cara Menjalankan Project

### A. Prasyarat

- **Docker** dan **Docker Compose** terpasang di komputer Anda.

### B. Menjalankan dengan Docker Compose (Satu Perintah - Direkomendasikan)

1. Buka Terminal / PowerShell di folder root project (sesuaikan nama project):

   ```bash
   cd "path/to/healthcare"
   ```

2. Pastikan file konfigurasi `.env` telah tersedia (file `.env` default sudah disiapkan di root project, atau duplikasi dari `.env.example`):

   ```bash
   cp .env.example .env
   ```

3. Jalankan seluruh sistem:
   ```bash
   docker-compose up --build
   ```
   _(Opsional: tambahkan `-d` di akhir jika ingin berjalan di background)._

#### Apa yang Terjadi Secara Otomatis Saat Startup:

1. **PostgreSQL** menyala dan mengeksekusi script `docker/postgres/init.sql` untuk membuat dua basis data independen: `auth_db` dan `schedule_db`.
2. **Redis** menyala untuk caching query dan antrean job BullMQ.
3. **Mailpit** menyala untuk menangkap dan menampilkan email notifikasi lokal.
4. **Auth Service** dan **Schedule Service** menunggu PostgreSQL siap (`service_healthy`), kemudian mengeksekusi migrasi skema database (`npx prisma migrate deploy`), lalu server NestJS langsung aktif.

---

### C. Alamat Port & Akses Layanan

Setelah seluruh container berstatus **running**:

| Layanan              |  Port  | URL Akses                                                      | Deskripsi                                                     |
| :------------------- | :----: | :------------------------------------------------------------- | :------------------------------------------------------------ |
| **Auth Service**     | `3001` | [http://localhost:3001/graphql](http://localhost:3001/graphql) | GraphQL Sandbox / Playground untuk Register & Login           |
| **Schedule Service** | `3002` | [http://localhost:3002/graphql](http://localhost:3002/graphql) | GraphQL Sandbox / Playground untuk Customer, Doctor, Schedule |
| **Mailpit Web UI**   | `8025` | [http://localhost:8025](http://localhost:8025)                 | Web Dashboard untuk melihat email notifikasi yang terkirim    |
| **PostgreSQL**       | `5432` | `localhost:5432`                                               | Database server (`auth_db` & `schedule_db`)                   |
| **Redis**            | `6379` | `localhost:6379`                                               | Redis server untuk caching & antrean BullMQ                   |

---

### D. Menghentikan Layanan

Untuk mematikan container, tekan `Ctrl + C` pada terminal atau jalankan:

```bash
docker-compose down
```

---

## 2. Arsitektur Sistem

### A. Diagram Arsitektur (Mermaid)

```mermaid
flowchart TD
    Client["Client / Browser / Postman"]

    subgraph DockerNetwork["Healthcare Microservice Bridge Network"]
        direction TB

        subgraph AuthApp["Auth Service (:3001)"]
            AuthResolver["GraphQL Resolver"]
            AuthServiceLogic["Auth Service (bcrypt + JWT)"]
            AuthPrisma["Prisma ORM"]
            AuthResolver --> AuthServiceLogic --> AuthPrisma
        end

        subgraph ScheduleApp["Schedule Service (:3002)"]
            AuthGuard["Global AuthGuard"]
            ScheduleResolvers["GraphQL Resolvers\n(Customer, Doctor, Schedule)"]
            ScheduleLogic["Business Services\n(Validation & Conflict Checks)"]
            SchedulePrisma["Prisma ORM"]
            CacheService["Redis Cache Service"]
            EmailQueue["BullMQ Producer & Worker"]

            AuthGuard --> ScheduleResolvers --> ScheduleLogic
            ScheduleLogic --> SchedulePrisma
            ScheduleLogic --> CacheService
            ScheduleLogic --> EmailQueue
        end

        subgraph Infrastructure["Shared Infrastructure"]
            PostgreSQL[("PostgreSQL 16\n- auth_db\n- schedule_db")]
            RedisDB[("Redis 7\n- Cache & BullMQ Queue")]
            Mailpit["Mailpit SMTP (:1025)\nWeb UI (:8025)"]
        end
    end

    %% Client Interactions
    Client -->|"1. register / login"| AuthResolver
    Client -->|"2. Request + Bearer <token>"| AuthGuard

    %% Inter-service HTTP GraphQL Auth Check
    AuthGuard -.->|"3. HTTP POST validateToken(token)"| AuthResolver

    %% DB & Cache Connections
    AuthPrisma -->|"auth_db"| PostgreSQL
    SchedulePrisma -->|"schedule_db"| PostgreSQL
    CacheService <-->|"Query Cache Get / Invalidate"| RedisDB
    EmailQueue <-->|"Enqueue & Process Email Jobs"| RedisDB
    EmailQueue -->|"Send SMTP Notification"| Mailpit
```

### B. Diagram Arsitektur (ASCII)

```text
+-----------------------------------------------------------------------------------+
|                        CLIENT (Browser / Apollo Sandbox / Postman)               |
+-----------------------------------------------------------------------------------+
       |                                              |
       | 1. register / login                          | 2. GraphQL Request
       |    (returns Bearer Token)                    |    (Header: Authorization: Bearer <token>)
       v                                              v
+-------------------------------+             +-------------------------------------+
|   AUTH SERVICE (Port 3001)    | <.......... |   SCHEDULE SERVICE (Port 3002)      |
|-------------------------------|  3. HTTP    |-------------------------------------|
| - GraphQL: code-first Apollo  |  validate   | - Global AuthGuard (Inter-service)  |
| - bcrypt password hashing     |  token      | - Customer, Doctor, Schedule Modules|
| - JWT signing & validation    |             | - Double Conflict Prevention        |
| - Prisma ORM (auth_db)        |             | - BullMQ Queue Producer & Worker    |
+-------------------------------+             | - Redis Query Cache Layer           |
       |                                      +-------------------------------------+
       |                                              |            |           |
       | Reads/Writes                                 | Reads/     | Caching/  | Enqueue &
       v                                              v Writes     v Jobs      v Dispatch
+---------------------------------------------+ +----------+ +-----------+ +--------+
|                POSTGRESQL 16                | | REDIS 7  | |  MAILPIT  | | MAILPIT|
|  - auth_db (User credentials)               | | - Cache  | |  (SMTP)   | | (Web)  |
|  - schedule_db (Customer, Doctor, Schedule) | | - BullMQ | |   :1025   | |  :8025 |
+---------------------------------------------+ +----------+ +-----------+ +--------+
```

### C. Alur Otentikasi Antar-Service (Inter-Service Auth)

1. Klien mengirim permintaan mutasi `login` ke Auth Service dan menerima string `accessToken` (JWT).
2. Klien memanggil endpoint di Schedule Service dengan menyertakan header:
   ```http
   Authorization: Bearer <accessToken>
   ```
3. `AuthGuard` pada Schedule Service mengekstrak token dari request context, kemudian memanggil query `validateToken` ke Auth Service melalui HTTP GraphQL (`AUTH_SERVICE_URL`).
4. Jika valid, Auth Service merespons dengan data user (`id`, `email`), `req.user` diset, dan request diproses.
5. Jika token salah, kadaluarsa, atau header tidak ada, Schedule Service langsung mengembalikan error `401 UnauthorizedException`.

---

## 3. List Environment Variables

Seluruh konfigurasi dikelola melalui environment variables. Berikut daftar lengkap variabel yang digunakan:

| Nama Variabel           | Default Value                                                            | Service Pengguna | Penjelasan                                                  |
| :---------------------- | :----------------------------------------------------------------------- | :--------------: | :---------------------------------------------------------- |
| `POSTGRES_USER`         | `postgres`                                                               |     Database     | Username superuser PostgreSQL                               |
| `POSTGRES_PASSWORD`     | `postgres`                                                               |     Database     | Password superuser PostgreSQL                               |
| `POSTGRES_PORT`         | `5432`                                                                   |     Database     | Port PostgreSQL pada host                                   |
| `AUTH_SERVICE_PORT`     | `3001`                                                                   |   Auth Service   | Port HTTP untuk Auth Service                                |
| `AUTH_DATABASE_URL`     | `postgresql://postgres:postgres@postgres:5432/auth_db?schema=public`     |   Auth Service   | Connection string PostgreSQL ke database `auth_db`          |
| `JWT_SECRET`            | `supersecret-healthcare-jwt-key-...`                                     |   Auth Service   | Kunci rahasia untuk menandatangani token JWT                |
| `JWT_EXPIRES_IN`        | `1h`                                                                     |   Auth Service   | Masa aktif masa berlaku token JWT (misal: `1h`, `7d`)       |
| `SCHEDULE_SERVICE_PORT` | `3002`                                                                   | Schedule Service | Port HTTP untuk Schedule Service                            |
| `SCHEDULE_DATABASE_URL` | `postgresql://postgres:postgres@postgres:5432/schedule_db?schema=public` | Schedule Service | Connection string PostgreSQL ke database `schedule_db`      |
| `AUTH_SERVICE_URL`      | `http://auth-service:3001/graphql`                                       | Schedule Service | Endpoint internal GraphQL Auth Service untuk validasi token |
| `REDIS_HOST`            | `redis`                                                                  | Schedule Service | Hostname instance Redis di dalam docker network             |
| `REDIS_PORT`            | `6379`                                                                   | Schedule Service | Port instance Redis                                         |
| `MAIL_HOST`             | `mailpit`                                                                | Schedule Service | Hostname SMTP Mailpit untuk pengiriman email mock           |
| `MAIL_PORT`             | `1025`                                                                   | Schedule Service | Port SMTP Mailpit                                           |
| `MAIL_FROM`             | `"Healthcare System <noreply@healthcare.local>"`                         | Schedule Service | Alamat pengirim email notifikasi schedule                   |

---

## 4. Contoh GraphQL Queries & Mutations

### A. Auth Service (Port 3001)

Akses di: `http://localhost:3001/graphql`

#### 1. Registrasi User Baru (`register`)

```graphql
mutation RegisterUser {
  register(
    input: { email: "dokter.tirta@healthcare.local", password: "Password123!" }
  ) {
    accessToken
    user {
      id
      email
      createdAt
      updatedAt
    }
  }
}
```

#### 2. Login User (`login`)

```graphql
mutation LoginUser {
  login(
    input: { email: "dokter.tirta@healthcare.local", password: "Password123!" }
  ) {
    accessToken
    user {
      id
      email
    }
  }
}
```

#### 3. Validasi Token (`validateToken`)

Query ini dipanggil otomatis oleh Schedule Service, namun dapat diuji langsung:

```graphql
query ValidateToken {
  validateToken(token: "PASTE_JWT_ACCESS_TOKEN_DI_SINI") {
    id
    email
  }
}
```

---

### B. Header Autentikasi untuk Schedule Service

Sebelum menjalankan query di **Schedule Service (Port 3002)**, pasang header otentikasi di tab **Headers** (bagian bawah editor Sandbox/Playground atau di Postman):

```json
{
  "Authorization": "Bearer PASTE_JWT_ACCESS_TOKEN_DI_SINI"
}
```

---

### C. Customer Module (Schedule Service - Port 3002)

#### 1. Buat Customer Baru (`createCustomer`)

```graphql
mutation CreateCustomer {
  createCustomer(
    input: { name: "Budi Santoso", email: "budi.santoso@pasien.com" }
  ) {
    id
    name
    email
    createdAt
  }
}
```

#### 2. Update Customer (`updateCustomer`)

```graphql
mutation UpdateCustomer {
  updateCustomer(
    input: { id: "CUSTOMER_UUID_DI_SINI", name: "Budi Santoso, M.Kom" }
  ) {
    id
    name
    email
    updatedAt
  }
}
```

#### 3. Dapatkan Daftar Customer dengan Pagination (`customers`)

```graphql
query GetCustomers {
  customers(page: 1, limit: 10) {
    items {
      id
      name
      email
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

#### 4. Dapatkan Detail Customer by ID (`customer`)

```graphql
query GetCustomerById {
  customer(id: "CUSTOMER_UUID_DI_SINI") {
    id
    name
    email
    createdAt
    updatedAt
  }
}
```

#### 5. Hapus Customer (`deleteCustomer`)

> _Catatan: Penghapusan akan ditolak bila customer masih memiliki jadwal konsultasi aktif._

```graphql
mutation DeleteCustomer {
  deleteCustomer(id: "CUSTOMER_UUID_DI_SINI") {
    id
    name
    email
  }
}
```

---

### D. Doctor Module (Schedule Service - Port 3002)

#### 1. Buat Doctor Baru (`createDoctor`)

```graphql
mutation CreateDoctor {
  createDoctor(input: { name: "dr. Tirta Mandira Hudhi, Sp.JP" }) {
    id
    name
    createdAt
  }
}
```

#### 2. Update Doctor (`updateDoctor`)

```graphql
mutation UpdateDoctor {
  updateDoctor(
    input: {
      id: "DOCTOR_UUID_DI_SINI"
      name: "dr. Tirta Mandira Hudhi, Sp.JP, M.Kes"
    }
  ) {
    id
    name
    updatedAt
  }
}
```

#### 3. Dapatkan Daftar Doctor dengan Pagination (`doctors`)

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

#### 4. Dapatkan Detail Doctor by ID (`doctor`)

```graphql
query GetDoctorById {
  doctor(id: "DOCTOR_UUID_DI_SINI") {
    id
    name
    createdAt
    updatedAt
  }
}
```

#### 5. Hapus Doctor (`deleteDoctor`)

> _Catatan: Penghapusan akan ditolak bila dokter masih memiliki jadwal konsultasi aktif._

```graphql
mutation DeleteDoctor {
  deleteDoctor(id: "DOCTOR_UUID_DI_SINI") {
    id
    name
  }
}
```

---

### E. Schedule Module (Schedule Service - Port 3002)

#### 1. Buat Schedule Konsultasi Baru (`createSchedule`)

> _Fitur ini memvalidasi customer & dokter ada di database, memvalidasi dokter tidak bentrok jadwal di jam yang sama, dan otomatis mengirim email konfirmasi ke email customer via BullMQ & Mailpit._

```graphql
mutation CreateSchedule {
  createSchedule(
    input: {
      objective: "Pemeriksaan Tekanan Darah dan EKG Jantung"
      customerId: "CUSTOMER_UUID_DI_SINI"
      doctorId: "DOCTOR_UUID_DI_SINI"
      scheduledAt: "2026-11-20T10:00:00.000Z"
    }
  ) {
    id
    objective
    scheduledAt
    customerId
    doctorId
    customer {
      id
      name
      email
    }
    doctor {
      id
      name
    }
    createdAt
  }
}
```

#### 2. Dapatkan Daftar Schedules dengan Filter & Pagination (`schedules`)

Filter opsional: `doctorId`, `customerId`, `dateFrom`, `dateTo`.

```graphql
query GetSchedules {
  schedules(
    doctorId: "DOCTOR_UUID_DI_SINI"
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

#### 3. Dapatkan Detail Schedule by ID (`schedule`)

```graphql
query GetScheduleById {
  schedule(id: "SCHEDULE_UUID_DI_SINI") {
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

#### 4. Hapus / Batalkan Schedule (`deleteSchedule`)

> _Menghapus schedule dan memicu pengiriman email pembatalan ke customer via BullMQ & Mailpit._

```graphql
mutation DeleteSchedule {
  deleteSchedule(id: "SCHEDULE_UUID_DI_SINI") {
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

1. **Isolasi Database (Database-per-Service)**:
   - Menggunakan satu server PostgreSQL dengan dua database terpisah (`auth_db` dan `schedule_db`). Setiap service hanya terhubung ke databasenya masing-masing untuk menjaga batas konteks (_bounded context_) arsitektur microservices.
2. **Pencegahan Bentrok Jadwal (Conflict Prevention)**:
   - Diterapkan dua lapis pengamanan (_Defense-in-Depth_):
     - **Lapis Aplikasi (Service Level)**: Query validasi awal di `ScheduleService.createSchedule` yang mencari jadwal eksisting dokter pada waktu yang sama. Jika ada, melempar `ConflictException`.
     - **Lapis Basis Data (Database Level)**: Constraint `@@unique([doctorId, scheduledAt])` pada tabel `schedules`. Menjamin konsistensi data dari _race condition_ bila terdapat dua request konkuren bersamaan di milidetik yang sama.
3. **Kebijakan Hapus Customer & Doctor Berjadwal (Delete Handling)**:
   - Dipilih kebijakan **`Restrict`**.
   - _Alasan_: Pada sistem rekam medis/klinik, riwayat kunjungan pasien tidak boleh terhapus tiba-tiba secara cascade demi integritas audit medis dan histori pasien. Jika terdapat upaya menghapus customer atau doctor yang memiliki schedule aktif, sistem menolak dengan `BadRequestException` ("Please cancel or reassign schedules first").
4. **Strategi Caching Redis & Invalidation**:
   - Query daftar customer, doctor, dan schedule dicache di Redis selama 60 detik.
   - Setiap mutasi penambahan, perubahan, atau penghapusan otomatis menghapus key cache terkait (`customers:*`, `doctors:*`, `schedules:*`) sehingga respon query berikutnya dijamin selalu mutakhir.
   - Dilengkapi _graceful fallback_: bila Redis down, API tetap berfungsi normal membaca data langsung dari PostgreSQL.
5. **Antrean Email Notifikasi (BullMQ Queue)**:
   - Pengiriman email konfirmasi dan pembatalan schedule diproses secara asinkron di antrean BullMQ (`email-queue`). Mutasi GraphQL langsung mengembalikan hasil tanpa tertahan oleh proses kirim email.
   - Dilengkapi mock SMTP **Mailpit** sehingga email dapat diinspeksi secara visual melalui browser pada `http://localhost:8025`.

---

## 6. Unit Testing & Code Coverage

Setiap service telah dilengkapi rangkaian unit test menyeluruh menggunakan Jest, melampaui target minimum 50% coverage.

### Auth Service Tests

```bash
cd auth-service
npm test -- --coverage
```

- **Hasil**: 14 tests passed (2 suites passed)
- **Coverage**: **87.8%** statement coverage (`AuthService` 100% statements, 100% functions, 100% lines).

### Schedule Service Tests

```bash
cd schedule-service
npm test -- --coverage
```

- **Hasil**: 59 tests passed (7 suites passed)
- **Coverage**: **70.81%** statement coverage (`CustomerService` 100%, `DoctorService` 100%, `ScheduleService` 95.31%, `AuthGuard` 93.02%).

---
