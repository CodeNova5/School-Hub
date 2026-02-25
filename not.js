const admin = require("firebase-admin");

// 🔥 STEP 1: Paste your FULL service account JSON here
const serviceAccount = {
  "type": "service_account",
  "project_id": "hello-notif-b3353",
  "private_key_id": "d2600784d646af87460fb3c07a14ffb4c76a083c",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDKrozFcE7ZI6Qr\nHzEGn4AWFs8ylv/fRbjn8wCT/vHESalPVQ5luJ8ojkM7CeDXMYYDIwDqLmuZKbKb\nadPvBigSHI7/Bv2a36KNwbzQejkEeermSMwFG0BCsKLYwUCy3OCY16G4fDNCm4L+\nmBmMU6z26fD95EuqOhXaNDwSZ6o4MlpX+Hsvh52iSUQO128n0nskY7YmVlPQGDuP\n7pBbZ0S3EieW9bOffANjVMR+JKO2XujgsPJ8RnQGNPOco3jQjYwaOFQXND1xhs+G\nxxb5cie/hJ1Pz2gyv8/VzrJKs+DUBsuMtCxAkw1YpM9PhuA8EbquqElJDHyZzrbz\nvjfqBPhtAgMBAAECggEAJkfVeqz9l3Ft3l8jyVZywLlKJQn0Bd2LUPPKlik+zI4F\nFmDAOWInXWeRNyNkfgByiUEhORnPZLxFaakRSEHna5RNRcmyOIAomZGP8ehDwJ6u\nSRRSxFwjRPVLrJjDeYTSPsvrVYbPv7LTiPZ9TM25C2GgDLQDvoD+A5p+BhPiSH6T\nvbie44N7/polQtyQsTrM+xu09szYS585qYO9aEdElj+XF1mHXF07M1ZpkEoq9KdI\n6hYWoIMe5OZ9iV2CnjOR2DfZvQupWzDKU5Qq3hv7XYt6MRZk6MIZM8gCanypOpSS\n4XBUeyCyhcu48ZfwmAQ3HV2c7n7zz4XCkkw8YRGAwQKBgQD5nh1Qg4zhPWebp/1/\nVYWbuDVB9djpwmAYvYDQrSua10qJrcZL+TTFv9n7jmsaawnDjwJJjy5wiRun3Xkt\nUm5TX0DMP3qZRvwq9jVP3JAYV6PXIY1kIj7b11gu86MN6HxcuA8ff/pgv1lTVbAN\n1Df4TTWTOgFwV9FV9gzFWgSxWQKBgQDP3TbwrVYzhQ8+UwqsJ5pNHvuInNNN1Xl8\nHGY+K6JE37wXC7YHcJNxFVIQeyrY3G54JGjdUlDmqGDDajlPbZ0sU1tsxbP3VLrC\nQZiNXQVFhPB02RPv0FPoqa8DBQTqwuJiIbi9l+lXNsLtaMy5q8th+HOyn5IC5lYv\nT9276i0pNQKBgQCSEFic/W1Ze8H9zm5CrXuSJFddsotsNeZfc7xF358tax9dswbe\n/ANKV7opPiwj+FBtU2iGPLdy+HfrYWiAAcU3Gfzjx51oxaXXSdzmT20uIVJpF2QS\nHQvlPnyGdOCLyefDpZyL1SpgpHeTkQeFABKEREG+VenzoB+JioHslYE7eQKBgQCk\nVRtuQ1t296cJetVhLR4MAoaRhop3amHVAQ7D7/MlyEwHXDbYwuON73ElnnpNYFfl\nm8Nb1gwnjs6RL5WHef1cYbpR0CtrSg0sLnfQqs3UHDmN52Cfo2/y7NNz66/reY9I\nTaikG0lareyFjOjtkSgFmEq/2O+yYy+Xz+hY+9YgUQKBgBg8ux9WdfjteG/1kOdc\nqtW2TTtbXhWyxYOhbXpSASUFTAA6lOSGuAXPzPcaJxyPhHzIlMQWePY3uV/2xSVG\np0W38EsRtKVegMdiTRGLfGHNn3cxWYrOk4P6TJRVtdoz5et3Ne2je17Pqi4HEKYT\nC5oAGg78w71Z29XrPLatSd7Z\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-5g1qe@hello-notif-b3353.iam.gserviceaccount.com",
  "client_id": "113846181425841474743",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-5g1qe%40hello-notif-b3353.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// 🔥 STEP 2: Replace with your device FCM token
const DEVICE_TOKEN = "f36my-LGQ2fbifPdCzrV-x:APA91bHQGR3Ak-MihvqZVt_9x8oDeGIZaAfKVi8tv9qLzY2Op2Qc6iLMUG5hXaUuSCaC2Yy7rKxCI5VCkewV4AAhIqhncTd54Otowh7uITEaZ252iyFVm8g";
// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function sendNotification() {
  try {
    const message = {
      token: DEVICE_TOKEN,
      webpush: {
        notification: {
          title: "Test Notification 🚀",
          body: "If you see this, Firebase Admin is working!",
          icon: "/notification-icon.png",
        },
        fcmOptions: {
          link: "http://localhost:3000",
        },
      },
    };

    const response = await admin.messaging().send(message);

    console.log("✅ Notification sent successfully!");
    console.log("Message ID:", response);
  } catch (error) {
    console.error("❌ Error sending notification:");
    console.error(error);
  }
}

sendNotification();