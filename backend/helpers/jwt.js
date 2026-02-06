import jwt from "jsonwebtoken";

export const generateToken = ({ user_id, register_id, role }) => {
  return jwt.sign(
    {
      user_id,
      register_id,
      role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};
