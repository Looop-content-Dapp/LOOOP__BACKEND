const nodemailer = require("nodemailer");
const path = require("path");
const { default: hbs } = require("nodemailer-express-handlebars");

const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  secure: true,
  port: 465,
  auth: {
    user: "official@looopmusic.com",
    pass: "Looopmusic@$12",
  },
  logger: true,
  debug: true,
});

const handlebarOptions = {
  viewEngine: {
    extName: ".hbs",
    partialsDir: path.resolve("./emails/"),
    defaultLayout: false,
  },
  viewPath: path.resolve("./emails/"),
  extName: ".hbs",
};

transporter.use("compile", hbs(handlebarOptions));

const sendEmail = async (to, subject, template, context) => {
  try {
    const mailOptions = {
      from: `Looop Music <official@looopmusic.com>`,
      to,
      subject,
      template,
      context,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    return { success: true, message: "Email sent successfully!" };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, message: error.message };
  }
};

module.exports = sendEmail;
