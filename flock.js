var Flock = function (def_flock_size, cvs_width, cvs_height) {
    // Constants
    var FLOCK_SIZE = def_flock_size || 100,

        COHESION_WEIGHT   = .01,
        SEPARATION_WEIGHT =  30,
        ALIGNMENT_WEIGHT  =   4,

        NEIGHBOR_DISTANCE       = 60,
        CLOSE_NEIGHBOR_DISTANCE = 45;
        

    // Classes list
    var Vector, Buddy, Flock;

    // Vector
    Vector = function Vector(x, y) {
        if ( typeof x === 'number' ) {
            this.x = x;
            this.y = y;
        } else {
            this.x = 0;
            this.y = 0;
        }
    };

    Vector.prototype = {
        copy: function() {
            return new Vector(this.x, this.y);
        },
        angle: function() {
            return Math.atan2(this.y, this.x);
        },
        negation: function() {
            return new Vector(-this.x, -this.y);
        },
        add: function(vect) {
            return new Vector(this.x+vect.x, this.y+vect.y);
        },
        addTo: function(vect) {
            this.x += vect.x;
            this.y += vect.y;

            return this;
        },
        subtract: function(vect) {
            return this.add( vect.negation() );
        },
        multiply: function(scalar) {
            return new Vector(this.x * scalar,
                              this.y * scalar );
        },
        rotate: function(rad) {
            var x_tmp = this.x,
                y_tmp = this.y;

            this.x = x_tmp*Math.cos(rad) - y_tmp*Math.sin(rad);
            this.y = x_tmp*Math.sin(rad) + y_tmp*Math.cos(rad);
        },
        distance: function(vect) {
            var diff = this.subtract(vect);

            return Math.sqrt( Math.pow(diff.x, 2) + Math.pow(diff.y, 2) );
        },
        magnitude: function() {
            return Math.sqrt( Math.pow(this.x, 2) + Math.pow(this.y, 2) );
        },
        midpoint: function(vect) {
            return vect.subtract(this).multiply(0.5).add(this);
        },
        ceiling: function(max_magnitude) {
            var magnitude = this.magnitude(); 
            if (magnitude > max_magnitude) {
                var normalizer = max_magnitude / magnitude;
                
                this.x *= normalizer;
                this.y *= normalizer;
            }

            return this;
        }
    };
    
    var render_triangle = function(loc, angle, color, ctx) {
        ctx.save();
            
        // Rotate and place canvas in orientation and place of the buddy to
        // render
        ctx.translate(loc.x, loc.y);
        ctx.rotate(angle);

        // Style
        ctx.fillStyle = color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';

        ctx.beginPath();
        ctx.moveTo( 13,  0);
        ctx.lineTo(-13,  7);
        ctx.lineTo(-13, -7);
        ctx.lineTo( 13,  0);
        ctx.lineTo(-13,  7);
        ctx.stroke();
        ctx.fill();

        ctx.restore();

        return this;
    };

    // Buddy
    Buddy = function(loc, ctx) {
        // Use loc only if it is a Vector
        if (loc && loc instanceof Vector) {
            this.loc = loc.copy();
        } else {
            this.loc = new Vector(0, 0);
        }

        // make velocity components -1 < comp < 1
        this.vel = new Vector(Math.random()*2-1,Math.random()*2-1);

        // faster!
        this.vel.multiply(4);

        // use a global canvas 2d context
        this.ctx = ctx;
    };

    Buddy.prototype = {
        render: function() {
            render_triangle(this.loc, this.vel.angle(), '#4D649A', this.ctx);

            return this;
        },
        separate: function() {
            var vect = new Vector(0, 0);

            this.close_neighbors.forEach( function(member) {
                var diff = this.loc.subtract(member.loc);

                // closer the two members are each other, the stronger the
                // force
                var diff_magnitude = diff.magnitude();
                
                var CND = CLOSE_NEIGHBOR_DISTANCE;

                // get closeness of neighbor in 0-1 range and multiply
                vect.addTo( diff.multiply( Math.pow((CND-diff_magnitude)/CND, 2) ) );
            }, this);

            return vect;
        },
        align: function() {
            var vect = new Vector(0,0);

            // get average velocity of neighbors
            // first get the sum of all velocity vectors
            this.neighbors.forEach( function(member) {
                vect.addTo(member.vel);
            });

            // then divide the sum by number of members (vectors)
            if (this.neighbors.length !== 0) {
                vect = vect.multiply( 1/this.neighbors.length );
            }

            return vect;
        },
        cohere: function() {
            var vect = new Vector(0,0);

            // get average location of neighbors
            // first get the sum of all location vectors
            this.neighbors.forEach( function(member) {
                vect.addTo(member.loc);
            });

            // then divide by number of members (vectors)
            if (this.neighbors.length !== 0) {
                vect = vect.multiply( 1/this.neighbors.length );
            }

            return vect.subtract(this.loc);
        },
        flock: function() {
            var separation = this.separate().multiply(SEPARATION_WEIGHT);
            var alignment  = this.align().multiply(ALIGNMENT_WEIGHT);
            var cohesion   = this.cohere().multiply(COHESION_WEIGHT);

            return separation.add(alignment).add(cohesion);
        },
        step: function(allBuddies) {
            this.getNeighbors(allBuddies);

            var accel = this.flock().ceiling(.13);
            this.vel.addTo(accel).ceiling(2);
            this.loc.addTo(this.vel);
            this.keep_in_bounds();

            return this;
        },
        keep_in_bounds: function() {
            if (this.loc.x > cvs_width+20) {
                this.loc.x = -20;
            } 
            else if (this.loc.x < -20) {
                this.loc.x = cvs_width+20;
            }
            if (this.loc.y > cvs_height+20) {
                this.loc.y = -20;
            }
            else if (this.loc.y < -20) {
                this.loc.y = cvs_height+20;
            }

            return this;
        },
        isNeighbor: function(other_buddy) {
            return this.loc.distance(other_buddy.loc) < NEIGHBOR_DISTANCE ? true : false;
        },
        isCloseNeighbor: function(other_buddy) {
            return this.loc.distance(other_buddy.loc) < CLOSE_NEIGHBOR_DISTANCE ? true : false;
        },
        getNeighbors: function(buddies) {
            this.neighbors = [];
            this.close_neighbors = [];

            for (var i = 0; i < buddies.length; i++) {
                if (this.loc !== buddies[i].loc && this.isNeighbor(buddies[i])) {
                    this.neighbors.push(buddies[i]);

                    if (this.isCloseNeighbor(buddies[i])) {
                        this.close_neighbors.push(buddies[i]);
                    }
                }
            }
        }
    };

    // User Controlled Buddy
    var user_buddy = new Buddy(new Vector(100, 100), 0);

    user_buddy.render = function() {
        render_triangle(this.loc, this.vel.angle(), '#A68A53', this.ctx);

        return this;
    };

    user_buddy.step = function() {
        if (this.is_moving) {
            this.loc.addTo(this.vel);
        };

        // rotation speed constant
        var rad = .07;

        if (this.is_rotating) {
            if (this.rotate_clockwise) {
                this.vel.rotate(rad);
            }
            else {
                this.vel.rotate(-rad);
            }
        }

        this.keep_in_bounds();

        return this;
    };

    user_buddy.vel = new Vector(0,2);
    user_buddy.is_moving = false;

    user_buddy.move = function(evt) {
        var keyCode = evt.keyCode || evt.which;

        // 'WAD' to move
        switch (keyCode) {
            // W
            case 87:
                user_buddy.is_moving = true;
                break;
            // A
            case 65:
                user_buddy.is_rotating = true;
                user_buddy.rotate_clockwise = false;
                break;
            // D
            case 68:
                user_buddy.is_rotating = true;
                user_buddy.rotate_clockwise = true;
                break;
        }
    };

    user_buddy.stopMove = function(evt) {
        var keyCode = evt.keyCode || evt.which;

        // 'WAD' to move
        switch (keyCode) {
            // W
            case 87:
                user_buddy.is_moving = false;
                break;
            // A or D
            case 65:
            case 68:
                user_buddy.is_rotating = false;
                break;
        }
    };


     
    // Flock
    Flock = function(spawn, auto_num, ctx) {
        this.spawn = spawn || new Vector(0, 0);
        auto_num = auto_num || 0;
        this.members = [];

        for (var i = 0; i < auto_num; i++) {
            this.members.push(new Buddy(this.spawn, ctx));
        }

        user_buddy.ctx = ctx;
        this.members.push(user_buddy);
    };

    Flock.prototype = {
        applyToAll: function(method) {
            // supply additional arguments without <method> to all members
            var args = Array.prototype.slice.call(arguments, 1);

            // make callback function for use with the [].forEach function
            var callBack = function(member, index, member_list) {
                member[method].apply(member, args);
            }

            // WARNING: [].forEach is a relatively new function. Consider
            //          implementing substitute
            this.members.forEach(callBack);

            return this;
        },
        render: function() {
            this.applyToAll('render');
 
            return this;
       },
       step: function() {
            this.applyToAll('step', this.members);
 
            return this;
       }
    };
    
    // Setup code
    var init = function() {
        var cvs = document.getElementById('flock_canvas');

        // This may look very hacky, cause it kinda is, but let me explain!
        // First, we make the dimension variables passed to Flock() the
        //     definitive dimensions by using whatever values are at hand, with a
        //     preference being the variables themselves.
        cvs_width = cvs_width || cvs.width || 400;
        cvs_height = cvs_height || cvs.height || 400;
        
        // Second, we make the canvas element the desired dimensions
        cvs.width = cvs_width;
        cvs.height = cvs_height;

        var ctx = cvs.getContext('2d');

        document.addEventListener('keydown', user_buddy.move);
        document.addEventListener('keyup',   user_buddy.stopMove);

        var flock = new Flock(new Vector(cvs_width/2, cvs_height/2), FLOCK_SIZE, ctx);
        setInterval(loop, 1000/45, flock, ctx);
    };

    var loop = function(flock, ctx) {
        ctx.clearRect(0, 0, 1000, 1000);

        flock.render().step();
    };

    init();
};
