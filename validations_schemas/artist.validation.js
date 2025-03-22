import * as yup from "yup";

export const createArtistSchema = yup.object().shape({
  artistname: yup.string().trim().required("Artist name is required"),
  email: yup
    .string()
    .trim()
    .email("Invalid email")
    .required("Email is required"),
  profileImage: yup
    .string()
    .trim()
    .url("Invalid profile image URL")
    .required("Profile image is required"),
  bio: yup.string().trim().required("Bio is required"),
  genres: yup
    .array()
    .of(yup.string().trim())
    .min(1, "At least one genre must be specified"),
  twitter: yup
    .string()
    .trim()
    .url("Invalid Twitter URL")
    .required("Twitter social is required"),
  tiktok: yup
    .string()
    .trim()
    .url("Invalid TikTok URL")
    .required("TikTok social is required"),
  instagram: yup
    .string()
    .trim()
    .url("Invalid Instagram URL")
    .required("Instagram social is required"),
  address1: yup.string().trim().required("Address 1 is required"),
  address2: yup.string().trim().optional(),
  country: yup.string().trim().required("Country is required"),
  city: yup.string().trim().required("City is required"),
  postalcode: yup.string().trim().required("Postal code is required"),
  websiteurl: yup
    .string()
    .url('Invalid website URL')
    .transform((value) => {
      // Automatically add http:// if no protocol is present
      if (value && !/^https?:\/\//i.test(value)) {
        return `http://${value}`;
      }
      return value;
    })
    .nullable(),
  id: yup.string().trim().required("User ID is required"),
});

export const signContractSchema = yup.object().shape({
  artistname: yup.string().trim().required("Artist name is required"),
  artistAddress: yup.string().trim().required("Artist address is required"),
});
