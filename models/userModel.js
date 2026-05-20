
const mongoose =require ('mongoose')
const userSchema=new mongoose.Schema({
    email:{type:String,required:true,unique:true,lowercase: true, // بيحول أي إيميل لحروف صغيرة
        trim: true},
    passwordHash: { type: String ,required:true},
    googleId:{ type: String ,required:function(){
        return !this.googleId
    }},
    role:{ type: String, enum: ['CUSTOMER', 'BRAND_OWNER', 'BAZAAR_OWNER','ADMIN'],default:"CUSTOMER", required: true },

},
{timestamps:true})
const User=mongoose.model('User',userSchema)
module.exports=User