import * as yup from "yup";

export const createUserSchema = yup.object().shape({
  email: yup
    .string()
    .trim()
    .email("Must be a valid email")
    .required("Email is required"),
  password: yup
    .string()
    .trim()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
  username: yup.string().trim().required("Username is required"),
  fullname: yup.string().trim().required("Fullname is required"),
  age: yup.string().trim().required("Age is required"),
  gender: yup
    .string()
    .trim()
    .oneOf(["male", "female"], "Gender must be 'male' or 'female'")
    .required("Gender is required"),
  referralCode: yup.string().trim().optional(),
});

export const signInSchema = yup.object().shape({
  email: yup
    .string()
    .trim()
    .email("Must be a valid email")
    .required("Email is required"),
  password: yup
    .string()
    .trim()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
});

export const googleAuthSchema = yup.object().shape({
  idToken: yup.string().trim().required("Google ID Token is required"),
});

export const appleAuthSchema = yup.object().shape({
  identityToken: yup
    .string()
    .trim()
    .required("Apple Identity Token is required"),
});

export const verifyOtpSchema = yup.object().shape({
  email: yup
    .string()
    .trim()
    .email("Must be a valid email")
    .required("Email is required"),
  otp: yup.string().required("OTP is required"),
});
