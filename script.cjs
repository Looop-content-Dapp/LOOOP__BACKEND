// const nodemailer = require("nodemailer");
// const path = require("path");
// const { default: hbs } = require("nodemailer-express-handlebars");

// const transporter = nodemailer.createTransport({
//   // host: 'smtp.zoho.com',
//   host: "smtp.hostinger.com",
//   secure: false,
//   // port: 465,
//   port: 587,
//   auth: {
//     user: "looopofficial@looopmusic.xyz",
//     pass: "Happydaysahead@$123",
//   },
//   logger: true, // Enables debug logging
//   debug: true,
// });

// const handlebarOptions = {
//   viewEngine: {
//     extName: ".hbs",
//     partialsDir: path.resolve("./emails/"),
//     defaultLayout: false,
//   },
//   viewPath: path.resolve("./emails/"),
//   extName: ".hbs",
// };

// transporter.use("compile", hbs(handlebarOptions));

// const sendEmail = async (to, subject, template, context) => {
//   try {
//     const mailOptions = {
//       from: `"Looop Music <${process.env.EMAIL_USER}>`,
//       to,
//       subject,
//       template,
//       context,
//     };

//     const info = await transporter.sendMail(mailOptions);
//     console.log("Email sent:", info.response);
//     return { success: true, message: "Email sent successfully!" };
//   } catch (error) {
//     console.error("Error sending email:", error);
//     return { success: false, message: error.message };
//   }
// };

// module.exports = sendEmail;
