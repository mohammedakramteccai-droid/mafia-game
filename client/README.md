# Mafia Game Client

واجهة React/Vite للعبة المافيا.

## Development

```bash
npm install
npm run dev
```

الواجهة المحلية تتصل افتراضياً بالسيرفر على:

```text
http://localhost:3001
```

## Static Hosting

إذا نشرت الواجهة على Appwrite Sites أو أي استضافة ثابتة، يجب تشغيل السيرفر في خدمة Node.js منفصلة ثم تمرير رابطه وقت البناء:

```bash
VITE_SOCKET_URL=https://your-mafia-server.example.com npm run build
```

بدون `VITE_SOCKET_URL` ستحاول نسخة الإنتاج الاتصال بنفس دومين الواجهة، وهذا يعمل فقط عندما تكون الواجهة والسيرفر منشورين معاً على نفس خدمة Node.js.
