# Incident Response — iShifo

## Severity darajalari

| Daraja | Misol | Javob vaqti |
|--------|-------|-------------|
| CRITICAL | DB down, ma'lumot sizib chiqishi | 15 daqiqa |
| HIGH | Video/TURN ishlamayapti | 1 soat |
| MEDIUM | AI offline, SMS ishlamayapti | 4 soat |
| LOW | UI xato, hisobot kechikishi | 24 soat |

## Jarayon
1. **Aniqlash** — monitoring (Grafana), foydalanuvchi xabari, audit log
2. **Hisobot** — `POST /api/compliance/incidents` yoki admin kanali
3. **Izolatsiya** — kerak bo'lsa API/nginx to'xtatish
4. **Tuzatish** — backup restore, hotfix, rollback
5. **Post-mortem** — 48 soat ichida hujjat

## Kontaktlar (to'ldiring)
- On-call admin: _______________
- DB admin: _______________
- FJSTI mas'ul shifokor: _______________

## Foydali buyruqlar
```bash
docker compose --profile prod logs -f api
curl https://DOMAIN/api/health/ready
./scripts/backup/postgres.sh
```
