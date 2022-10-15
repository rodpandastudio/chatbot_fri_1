const { getData, getReply, saveMessageMysql } = require('./mysql')
const { saveMessageJson } = require('./jsonDb')
const { getDataIa } = require('./diaglogflow')
const stepsInitial = require('../flow/initial.json')
const stepsReponse = require('../flow/response.json')
const keywordsDB = require('../models/keywords')
const keyDB = require('../models/key')
const ordenCompraDB = require('../models/orden-compra')
const ventasDB = require('../models/ventas')
const productosDB = require('../models/productos')
const promocionesDB = require('../models/promociones')
const stepsDB = require('../models/steps')
const moment = require('moment')

let promoActiva
let promoBase
let productoBase  
let Promociones = {}
let Productos = {}
let Opciones = []
let subdataOpciones = {}
let _idUltimaVenta = false

let ultimaVentaRealizada = false

const get = async (message) => new Promise(async (resolve, reject) => {
    /**
     * Si no estas usando un gesto de base de datos
    */

    if (process.env.DATABASE === 'none') {
        const { key } = stepsInitial.find(k => k.keywords.includes(message)) || { key: null }
        const response = key || null
        resolve(response)
    }
    /**
     * Si usas MONGODB
    */
    if (process.env.DATABASE === 'mongodb') {
        //recibimos mensaje

        let step = false
        console.log(message)
        if(message == "nuevo pedido" ){
            step = 1 // preguntar si es promo o producto
            await ordenCompraDB.findOneAndRemove()
            let orden = new ordenCompraDB()
            orden.save()
        } else if (message == "ver resumen"){
            console.log("_idUltimaVenta")
            console.log(_idUltimaVenta)
            if(_idUltimaVenta){
                step = 11
            }else{
                step = 0                
            }
            console.log("step")
            console.log(step)
        }
         else if(message == "promo" ){
            step = 2.1 //motrar promos
        }else if(message == "productos" ){
            step = 2.2 //mostrar productos
        } else if (message == "finalizar"){
            step = 6
        } else if (message == "agregar mas"){
            step = 1
        }  
        else{
            let stepBase = await stepsDB.findOne()
            if(stepBase){
                if(stepBase.step == "Promo"){
                    promoActiva = message
                    let nombrePromocion = new RegExp(message, 'i')
                    promoBase = await promocionesDB.findOne({Nombre: nombrePromocion})
                    Promociones._idPromocion = promoBase._id
                    Promociones.Nombre = promoBase.Nombre
                    Promociones.Descripcion = promoBase.Descripcion
                    Promociones.PrecioUnidad = promoBase.Precio
                    step = 2.3 // mostrar opciones
                }
                if(stepBase.step == "Tipo"){
                    Productos.Tipo = message
                    step = 3 // Preguntar cantidad
                }
                if (stepBase.step == "Productos"){
                    let nombreProducto = new RegExp(message, 'i')
                    productoBase = await productosDB.findOne({nombre: nombreProducto})
                    Productos.Nombre = message
                    Productos._idProducto = productoBase._id
                    Productos.PrecioUnidad = productoBase.Precio
                    Productos.Descripcion = productoBase.Descripcion
                    step = 3.1 // Tipo 
                }
                if (stepBase.step == "Agregando opciones"){
                    subdataOpciones.nombreOpcion = message
                    step = 3.5 //Tipo
                }
                if (stepBase.step == "Tipo opciones"){
                    step = 3.5 //Tipo
                }
                if (stepBase.step == "Agregando opciones 2"){
                    if(message == "no agregar"){
                        step = 3 //Preguntar cantidad
                    }else{
                        subdataOpciones.nombreOpcion = message
                        step = 3.5 //Tipo
                    }
                }
                if (stepBase.step == "Agregando mas opciones"){
                    if(message == "no agregar"){
                        step = 3 //Preguntar cantidad
                    }else{
                        subdataOpciones.tipo = message
                        Opciones.push(subdataOpciones)
                        subdataOpciones = {}
                        step = 3.2 //Tipo
                    }
                }
                if(stepBase.step == "Cantidad"){
                    if(Productos.Nombre){
                        Productos.Cantidad = message
                        Productos.PrecioTotal = Productos.Cantidad * Productos.PrecioUnidad
                    }
                    if(Promociones.Nombre){
                        Promociones.Cantidad = message
                        Promociones.Opciones = Opciones
                        Promociones.PrecioTotal = (Promociones.Cantidad * Promociones.PrecioUnidad).toFixed(2)
                    }
                    step = 4 //Nota
                }
                if(stepBase.step == "Nota"){
                    if(Productos.Nombre){
                        Productos.Nota = message
                        await ordenCompraDB.findOneAndUpdate({ $push: { Productos: Productos } })
                        Productos = {}
                    }
                    if(Promociones.Nombre){
                        Promociones.Nota = message
                        await ordenCompraDB.findOneAndUpdate({ $push: { Promociones: Promociones } })
                        Promociones = {}
                    }
                    step = 5 //confirmar
                }
                if(stepBase.step == "NombreCliente"){
                    await ordenCompraDB.findOneAndUpdate({NombreCliente: message})
                    step = 7
                }
                if(stepBase.step == "DireccionCliente"){
                    await ordenCompraDB.findOneAndUpdate({DireccionCliente: message})
                    step = 8
                }
                if(stepBase.step == "TelefonoCliente"){
                    await ordenCompraDB.findOneAndUpdate({TelefonoCliente: message})

                    step = 9
                }
                if(stepBase.step == "Tipo entrega"){
                    await ordenCompraDB.findOneAndUpdate({TipoEntrega: message})
                    let ordenCompleta = await ordenCompraDB.findOne()
                    let PrecioTotal = 0
                    let CantidadTotal = 0
                    ordenCompleta.Promociones.forEach(element => {
                        PrecioTotal += element.PrecioTotal
                        CantidadTotal += element.Cantidad
                    });
                    ordenCompleta.Productos.forEach(element => {
                        PrecioTotal += element.PrecioTotal
                        CantidadTotal += element.Cantidad
                    });
                    let Numero = 1
                    let ultimaVenta = await ventasDB.findOne().sort({Numero: -1})
                    if(ultimaVenta){
                        Numero = ultimaVenta.Numero + 1
                    }

                    
                    let Fecha = moment().format('L');
                    Fecha = Fecha.split('/');
                    Fecha = `${Fecha[1]}/${Fecha[0]}/${Fecha[2]}`;
                    let hora = moment().format('LTS');

                    let nuevaVenta = new ventasDB({
                        Fecha: Fecha,
                        FechaCompleta: `${Fecha} ${hora}`,
                        Timestamp: Date.now(),
                        Numero: Numero,
                        Cliente: ordenCompleta.NombreCliente.toUpperCase(),
                        Dirección: ordenCompleta.DireccionCliente,
                        Telefono: ordenCompleta.TelefonoCliente,
                        Vendedor: process.env.VENDEDOR,
                        Sucursal: process.env.SUCURSAL,
                        TipoEntrega: ordenCompleta.TipoEntrega,
                        CantidadTotal: CantidadTotal,
                        PrecioTotal: PrecioTotal,
                        Promociones: ordenCompleta.Promociones,
                        Productos: ordenCompleta.Productos,
                    })
                    ultimaVentaRealizada = Numero
                    _idUltimaVenta = nuevaVenta._id
                    await nuevaVenta.save()
                    await ordenCompraDB.deleteOne()
                    await stepsDB.deleteOne()

                    step = 10
                }
            }else{
                step = 0 //error 
            }
        }
        if(!step){
            step = "error" //error
        }

        resolve(step)
    }
})

const reply = (step) => new Promise(async (resolve, reject) => {
    /**
     * Si usas MONGODB
     */
    let pasoEnCurso= await stepsDB.findOne()
    if(pasoEnCurso){
        console.log("pasoEnCurso",pasoEnCurso.step)
    }
    if (process.env.DATABASE === 'mongodb') {
        //emviamos mensaje
        let replyMessage = ``
        if(step === 1){
            replyMessage = `Escriba el tipo de item: \n *Promo* \n *Productos*`
        } else if(step === "error"){
            console.log("error")
            replyMessage = `Ups!, no entendí el comando. Si quiere un nuevo pedido escriba *Nuevo pedido*`
        } 
        else if(step === 2.1){
            //Promos
            let promociones = await promocionesDB.find().sort({Nombre:1}).select('Nombre')
            replyMessage = `Escriba el nombre de la promocion: \n`
            for (let i = 0; i < promociones.length; i++) {
                replyMessage += `*${promociones[i].Nombre}*\n`
            }

            let steps = await stepsDB.findOne()
            if(steps){
                await stepsDB.findOneAndUpdate({step:'Promo'})
            }else{
                let nuevoStep = new stepsDB({
                    step: 'Promo'
                })
                await nuevoStep.save()
            }

        } else if(step === 2.2){
            //Productos
            let productos = await productosDB.find().sort({Nombre:1}).select('Nombre')
            replyMessage = `Escriba el nombre del producto: \n`
            for (let i = 0; i < productos.length; i++) {
                replyMessage += `*${productos[i].Nombre}*\n`
            }
            let steps = await stepsDB.findOne()
            if(steps){
                await stepsDB.findOneAndUpdate({step:'Productos'})
            }else{
                let nuevoStep = new stepsDB({
                    step: 'Productos'
                })
                await nuevoStep.save()
            }
        } 
        else if  (step === 2.3){
            promoActiva = new RegExp(promoActiva, 'i')
            console.log(promoActiva)
            let promocion = await promocionesDB.findOne({Nombre:promoActiva})
            replyMessage = `Escriba el nombre de la opcion a agregar\n`
            for (let i = 0; i < promocion.Opciones.length; i++) {
                replyMessage += `${i+1} - *${promocion.Opciones[i].Nombre}*\n`
            }
            await stepsDB.findOneAndUpdate({step:'Agregando opciones'})

        }
        else if(step === 3){
            //Cantidad
            replyMessage = `Escriba la cantidad: \n`
            await stepsDB.findOneAndUpdate({step:'Cantidad'})
        }
        else if(step === 3.5){
            //Cantidad
            replyMessage = `Escriba el tipo: \n *Normal* \n *Tempura* \n *Frio*` 
            await stepsDB.findOneAndUpdate({step:'Agregando mas opciones'})
        }
        else if(step === 3.1){
            //Cantidad
            replyMessage = `Escriba el tipo: \n *Normal* \n *Tempura* \n *Frio*` 
            await stepsDB.findOneAndUpdate({step:'Tipo'})
        }
        else if(step === 3.2){
            //preguntar mas opciones
            promoActiva = new RegExp(promoActiva, 'i')
            let promocion = await promocionesDB.findOne({Nombre:promoActiva})
            replyMessage = `Escriba el nombre de la opcion a agregar\n`
            for (let i = 0; i < promocion.Opciones.length; i++) {
                replyMessage += `${i+1} - *${promocion.Opciones[i].Nombre}*\n`
            }
            replyMessage += `*No agregar*`
            await stepsDB.findOneAndUpdate({step:'Agregando opciones 2'})
        }
        else if(step === 4){
            replyMessage = `Nota de producto:`
            await stepsDB.findOneAndUpdate({step:'Nota'})
        }
        else if(step === 5){
            replyMessage = `Item agregado correctamente: \n *Finalizar* \n *Agregar mas*`
            await stepsDB.findOneAndUpdate({step:'Nota'})
        }
        else if (step === 6){
            replyMessage = `Introduzca el nombre del cliente: `
            await stepsDB.findOneAndUpdate({step:'NombreCliente'})
        }
        else if (step === 7){
            replyMessage = `Introduzca la dirección cliente: `
            await stepsDB.findOneAndUpdate({step:'DireccionCliente'})
        } 
        else if (step === 8){
            replyMessage = `Introduzca el teléfono cliente: `
            await stepsDB.findOneAndUpdate({step:'TelefonoCliente'})
        }
        else if (step === 9){
            replyMessage = `Tipo de entrega:  \n *Pick up* \n *Delivery*`
            await stepsDB.findOneAndUpdate({step: 'Tipo entrega'})
        }
        else if (step === 10){
            replyMessage = `Pedido realizado correctamente: ✅  \n *Ver resumen* \n *Nuevo pedido* `
            await stepsDB.findOneAndRemove()
        } else if (step === 11){
            console.log("step 11")
            let ultimaVenta = await ventasDB.findById(_idUltimaVenta)
            replyMessage = `Resumen de pedido  \n Venta #${ultimaVenta.Numero} \n Cliente : ${ultimaVenta.Cliente} \n Direccion : ${ultimaVenta.Dirección} \n Telefono : ${ultimaVenta.Telefono} \n Tipo de entrega : ${ultimaVenta.TipoEntrega} \n Precio total : $${ultimaVenta.PrecioTotal} \n Cantidad total : ${ultimaVenta.CantidadTotal} \n Para realizar nuevo pedido escriba *Nuevo pedido*`
        }


        let resData = { replyMessage, media: null, trigger: null }
    

        resolve(resData);
                
    }
    /**
    * Si no estas usando un gesto de base de datos
    */
    if (process.env.DATABASE === 'none') {
        let resData = { replyMessage: '', media: null, trigger: null }
        const responseFind = stepsReponse[step] || {};
        resData = {
            ...resData, 
            ...responseFind,
            replyMessage:responseFind.replyMessage.join('')}
        console.log(resData)
        resolve(resData);
        return 
    }
})

const getIA = (message) => new Promise((resolve, reject) => {
    /**
     * Si usas dialogflow
     */
     if (process.env.DATABASE === 'dialogflow') {
        let resData = { replyMessage: '', media: null, trigger: null }
        getDataIa(message,(dt) => {
            resData = { ...resData, ...dt }
            resolve(resData)
        })
    }
})

/**
 * 
 * @param {*} message 
 * @param {*} date 
 * @param {*} trigger 
 * @param {*} number 
 * @returns 
*/
const saveMessage = ( message, trigger, number  ) => new Promise( async (resolve, reject) => {
     switch ( process.env.DATABASE ) {
         case 'mysql':
             resolve( await saveMessageMysql( message, trigger, number ) )
             break;
         case 'none':
             resolve( await saveMessageJson( message, trigger, number ) )
             break;
         default:
             resolve(true)
             break;
    }
})

module.exports = { get, reply, getIA, saveMessage }