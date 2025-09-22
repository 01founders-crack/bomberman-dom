export class Router {
    constructor(routes) {
        this.routes = routes;
        this.currentRoute = '';
        
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
    }

    handleRoute() {
        this.currentRoute = window.location.hash.slice(1) || '/';
        const handler = this.routes[this.currentRoute];
        if (handler) handler();
    }
}