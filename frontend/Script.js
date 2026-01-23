const carrito = document.querySelector("#carrito");
const listaCarrito = document.querySelector("#lista-carrito tbody");
const listaProductos = document.querySelector("#lista-1");
const vaciarCarritoBtn = document.querySelector("#vaciar-carrito");
const iconoCarrito = document.querySelector("#img-carrito");
const contadorCarrito = document.querySelector("#contador-carrito");
const totalCarrito = document.querySelector("#total-carrito");
const checkoutBtn = document.querySelector("#checkout");
const linkServicios = document.querySelector('a[href="#servicios"]');
const serviciosExtra = document.querySelector("#servicios-extra");
const linkContacto = document.querySelector('a[href="#contacto"]');
const contactoInfo = document.querySelector("#contacto-info");

let articulosCarrito = [];

function cargarEventListeners() {
    document.addEventListener("click", agregarProducto);

    if (carrito) {
        carrito.addEventListener("click", manejarCarrito);
    }

    if (vaciarCarritoBtn) {
        vaciarCarritoBtn.addEventListener("click", vaciarCarrito);
    }

    if (iconoCarrito) {
        iconoCarrito.addEventListener("click", toggleCarrito);
    }

    document.addEventListener("click", cerrarCarritoFuera);

    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", irCheckout);
    }

    if (linkServicios && serviciosExtra) {
        const navLinks = document.querySelectorAll(".navbar a");
        linkServicios.addEventListener("click", () => {
            serviciosExtra.classList.add("is-visible");
            if (contactoInfo) {
                contactoInfo.classList.remove("is-visible");
            }
        });
        navLinks.forEach((link) => {
            if (link === linkServicios) {
                return;
            }
            link.addEventListener("click", () => {
                serviciosExtra.classList.remove("is-visible");
            });
        });
    }

    if (linkContacto && contactoInfo) {
        linkContacto.addEventListener("click", () => {
            contactoInfo.classList.add("is-visible");
            if (serviciosExtra) {
                serviciosExtra.classList.remove("is-visible");
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        const guardados = localStorage.getItem("carrito");
        articulosCarrito = guardados ? JSON.parse(guardados) : [];
        carritoHTML();
    });
}

function agregarProducto(e) {
    if (!e.target.classList.contains("agregar-carrito")) {
        return;
    }

    e.preventDefault();
    const boton = e.target;
    const producto = boton.closest(".box, .Grandes-1");
    if (!producto) {
        return;
    }

    leerDatosProducto(producto);
    notificarAgregado(boton);
}

function leerDatosProducto(producto) {
    const boton = producto.querySelector(".agregar-carrito");
    const infoProducto = {
        imagen: producto.querySelector("img")?.src || "",
        titulo: producto.querySelector("h3")?.textContent?.trim() || "Producto",
        precio: producto.querySelector(".precio")?.textContent?.trim() || "",
        id: boton?.getAttribute("data-id") || String(Date.now()),
        cantidad: 1,
    };

    const existe = articulosCarrito.find((item) => item.id === infoProducto.id);
    if (existe) {
        existe.cantidad += 1;
    } else {
        articulosCarrito = [...articulosCarrito, infoProducto];
    }

    carritoHTML();
}

function notificarAgregado(boton) {
    if (!boton) {
        return;
    }
    if (!boton.dataset.originalText) {
        boton.dataset.originalText = boton.textContent;
    }
    boton.textContent = "Agregado";
    boton.classList.add("agregado");

    clearTimeout(boton._timer);
    boton._timer = setTimeout(() => {
        boton.textContent = boton.dataset.originalText || "Agregar al carrito";
        boton.classList.remove("agregado");
    }, 1200);
}

function manejarCarrito(e) {
    const target = e.target;
    if (!target) {
        return;
    }

    if (target.classList.contains("borrar-producto")) {
        e.preventDefault();
        const id = target.getAttribute("data-id");
        articulosCarrito = articulosCarrito.filter((item) => item.id !== id);
        carritoHTML();
        return;
    }

    if (target.classList.contains("sumar-producto")) {
        e.preventDefault();
        const id = target.getAttribute("data-id");
        const item = articulosCarrito.find((prod) => prod.id === id);
        if (item) {
            item.cantidad += 1;
            carritoHTML();
        }
        return;
    }

    if (target.classList.contains("restar-producto")) {
        e.preventDefault();
        const id = target.getAttribute("data-id");
        const item = articulosCarrito.find((prod) => prod.id === id);
        if (item) {
            item.cantidad -= 1;
            if (item.cantidad <= 0) {
                articulosCarrito = articulosCarrito.filter((prod) => prod.id !== id);
            }
            carritoHTML();
        }
    }
}

function vaciarCarrito(e) {
    e.preventDefault();
    articulosCarrito = [];
    carritoHTML();
}

function carritoHTML() {
    limpiarHTML();

    articulosCarrito.forEach((item) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <img src="${item.imagen}" width="60" alt="${item.titulo}">
            </td>
            <td>${item.titulo}</td>
            <td>
                <div class="cantidad-control">
                    <button class="restar-producto" data-id="${item.id}">−</button>
                    <span>${item.cantidad}</span>
                    <button class="sumar-producto" data-id="${item.id}">+</button>
                </div>
            </td>
            <td>${item.precio}</td>
            <td>
                <a href="#" class="borrar-producto" data-id="${item.id}">X</a>
            </td>
        `;
        listaCarrito.appendChild(row);
    });

    sincronizarStorage();
    actualizarContador();
    actualizarTotal();
}

function sincronizarStorage() {
    localStorage.setItem("carrito", JSON.stringify(articulosCarrito));
}

function actualizarContador() {
    if (!contadorCarrito) {
        return;
    }
    const total = articulosCarrito.reduce((acc, item) => acc + item.cantidad, 0);
    contadorCarrito.textContent = total;
}

function actualizarTotal() {
    if (!totalCarrito) {
        return;
    }
    const total = articulosCarrito.reduce((acc, item) => {
        const limpio = item.precio.replace(/[^0-9.,]/g, "").replace(",", ".");
        const precio = Number(limpio) || 0;
        return acc + precio * item.cantidad;
    }, 0);
    totalCarrito.textContent = `$${total.toFixed(2)}`;
}

function toggleCarrito(e) {
    e.preventDefault();
    e.stopPropagation();
    const contenedor = iconoCarrito?.closest(".submenu");
    if (contenedor) {
        contenedor.classList.toggle("is-open");
    }
}

function cerrarCarritoFuera(e) {
    const contenedor = iconoCarrito?.closest(".submenu");
    if (!contenedor || !contenedor.classList.contains("is-open")) {
        return;
    }
    if (!contenedor.contains(e.target)) {
        contenedor.classList.remove("is-open");
    }
}

function irCheckout(e) {
    e.preventDefault();
    window.open("checkout.html", "_blank");
}

function limpiarHTML() {
    while (listaCarrito && listaCarrito.firstChild) {
        listaCarrito.removeChild(listaCarrito.firstChild);
    }
}

cargarEventListeners();
