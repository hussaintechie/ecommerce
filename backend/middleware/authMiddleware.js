import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
  if(process.env.DEV_MODE === "true")
  {
    req.user =
    {
      store_id:2,
      user_id :9,
      role :"user"
    };
    return next()
  }
  // try {
  //   const header = req.headers.authorization;

  //   if (!header || !header.startsWith("Bearer ")) {
  //     return res.status(401).json({ status: 0, message: "No token provided" });
  //   }

  //   const token = header.split(" ")[1];
  //   const decoded = jwt.verify(token, process.env.JWT_SECRET);

  //   req.user = decoded; // user_id, store_id, role
  //   next();
  // } catch (err) {
  //   return res.status(401).json({ status: 0, message: "Token expired or invalid" });
  // }
};
