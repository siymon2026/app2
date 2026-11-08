const fs=require("fs"), path=require("path");
const E=require("./engine"), SET=require("./set"), U=require("./ui");
(async()=>{
  const map={}; for(const n of ["burger","pizza","salad","drinks","grocery","pharmacy","restaurant","storefront"]){const p=path.join(__dirname,"../assets",n+".png"); if(fs.existsSync(p)) map[n]=await E.loadImage(p);}
  map.logo=await E.loadImage(path.join(__dirname,"../../public/icons/icon-512.png"));
  U.setImages(map);
  const cv=E.createCanvas(E.W,E.H), ctx=cv.getContext("2d");
  const cam=E.makeCam({pos:[2.0,1.35,7.0],target:[-0.5,1.0,-12],fov:42});
  SET.avenue(ctx,cam,4.2,{});
  const rt=[[-0.6,2],[-0.6,-2],[0,-8],[0.2,-16],[1.8,-26]];
  E.route(ctx,cam,rt,{progress:0.72,width:7,y:0.06,flowT:3.0});
  SET.pin(ctx,cam,[1.8,0,-26],4.2);
  const sp=SET.onAxis(cam,9.5,1.5,-1.35);
  SET.scooter(ctx,cam,{p:[sp[0],0,sp[2]],ry:-1.15,scale:1.0},{});
  E.post(ctx,E.makePost(),0,{bloom:0.5});
  fs.writeFileSync(path.join(__dirname,"../renders/still-city.png"),cv.toBuffer("image/png"));
  console.log("ok");
})();
