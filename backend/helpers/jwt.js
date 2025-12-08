import jwt from "jsonwebtoken";

export const generateToken = (user) => {
  return jwt.sign(
    {
      user_id: user.user>id,
      store_id: user.register_id,
      role: user.user_role
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};
