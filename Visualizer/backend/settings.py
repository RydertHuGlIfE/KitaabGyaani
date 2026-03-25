from fastapi_mail import ConnectionConfig

__all__ = ["conf"]
conf = ConnectionConfig(
    MAIL_USERNAME="dhruvthakur1616@gmail.com",
    MAIL_PASSWORD="wpco tjtw wmbw hhwm",
    MAIL_FROM="dhruvthakur1616@gmail.com",
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)