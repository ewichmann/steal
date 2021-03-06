steal("//steal/get/json", 
	  "//steal/rhino/prompt", 
	  "//steal/get/dummysteal",function( steal ) {
	
	// a map of plugins that you just installed (prevents cycles)
	var installed = {};
	
	/**
	 * @parent stealjs
	 * Downloads and installs a plugin from a url.  Normally this is run from the steal/getjs script.
	 * 
	 * <p>The following copies the mustache-javascript repo to a local mustache folder.</p>
	 * 
	 * @codestart text
	 * js steal/getjs "ttp://github.com/tdreyno/mustache-javascriptmvc mustache
	 * @codeend
	 * <p>Get will:</p>
	 * <ul>
	 * 	<li>Download the files that comprise the plugin.</li>
	 *  <li>Prompt you to install dependencies found in its dependencies.json file.</li>
	 *  <li>Prompt you to run an install script.</li>
	 * </ul>
	 * <h2>Offical Plugins</h2>
	 * <p>JavaScriptMVC maintains a list of offical plugins compatible with JavaScriptMVC 3.0.
	 *   You can install these by simply typing there name.  This is the current list of
	 *   offical plugins:
	 * </p>
	 * <ul>
	 * 	<li><code>mustache</code> - mustache templates.</li>
	 *  <li><code>steal</code> - script loader, and more.</li>
	 *  <li><code>jquery</code> - jQuery 1.4.3 and the MVC components.</li>
	 *  <li><code>funcunit</code> - Functional testing platform.</li>
	 *  <li><code>mxui</code> - UI widgets.</li>
	 *  <li><code>documentjs</code> - documentation engine.</li>
	 * </ul>
	 * <p>You can install these just by writing</p>
	 * @codestart text
	 * js steal/getjs funcunit
	 * @codeend
	 * <p>If you have something good, let us know on the forums and we can make your project official too!</p>
	 * <h2>The Get function</h2>
	 * get takes a url or official plugin name and installs it.
	 * @param {String} url the path to a svn or github repo or a name of a recognized plugin.
	 * @param {Object} options configure the download.  
	 * <table class='options'>
	 * 	  <tr>
	 * 	      <th>Name</th><th>Description</th>
	 * 	  </tr>
	 * 	  <tr><td>name</td>
	 * 	  	  <td>The name of the folder to put the download in.</td></tr>
	 *    <tr><td>ignore</td>
	 * 	  	  <td>An array of regexps that if the filename matches, these will be ignored.</td></tr>
	 * 	</table>
	 * 
	 */
	var get = (steal.get = function( url, options ) {
		options = steal.opts(options, {
			name: 1
		});
		var getter, name = options.name, dependenciesUrl;

		if (!url.match(/^http/) ) {
			name = url;
			url = pluginList(name);
		}
		if (!url ) {
			steal.print("There is no plugin named " + name);
			return;
		}
		getter = url.indexOf("github.com") !== -1 ? get.github : get.getter;
		if (!name ) {
			name = guessName(url);
		}
		//print("getting name "+name+" "+url);
		
		//make the folder for this plugin
		new steal.File(name).mkdirs();
		// do old dependency thing ...
		
		steal.print("  Checking dependencies ... ");
		dependenciesUrl = getter.dependenciesUrl(url);

		installDependencies(dependenciesUrl, name);

		// do new dependency thing ...
		var stealDependsUrl = getter.pluginDependenciesUrl(url);
		if(stealDependsUrl){
			get.installDependencies( get.pluginDependencies(stealDependsUrl) )
		}
		steal.print("   ");
		
		//get contents
		var fetcher = new getter(url, name, options);
		fetcher.quiet = options.quiet || true;

		fetcher.fetch();

		steal.print("\n  " + name + " plugin downloaded.");
		runInstallScript(name);

	}),
		/**
		 * @hide
		 * looks for a url elsewhere
		 * @param {Object} name
		 */
		pluginList = function( name ) {
			//steal.print("  Looking for plugin ...");

			var plugin_list_source =
				readUrl("https://github.com/jupiterjs/steal/raw/master/get/gets.json");
			var plugin_list;
			eval("plugin_list = " + plugin_list_source);
			if ( plugin_list[name] ) {
				return plugin_list[name];
			}
			// check if the first part matches ....
			var parts = name.split("/")
				firstPart = parts.shift();
			if(plugin_list[firstPart]){
				var first =  plugin_list[firstPart];
				if(/github\.com/.test(first) && !/tree\/\w+/.test(first)){
					// http://github.com/jupiterjs/mxui -> 
					//    http://github.com/jupiterjs/mxui/tree/master/util/selectable/
					return first+"/tree/master/"+parts.join("/")+"/"
					//first = first.replace(/[^\/]+$/g, function(end){
					//	
					//})
				}
				return first;
			}
			
			
			steal.print("  Looking in gets.json for your own plugin list")
			
			plugin_list_source = readFile("gets.json");
			if(plugin_list_source){
				eval("plugin_list = " + plugin_list_source);
				return plugin_list[name];
			}
			
		},
		//gets teh name from the url
		guessName = function( url ) {
			var name = new steal.File(url).basename();
			if ( name === 'trunk' || !name ) {
				name = new steal.File(new steal.File(url).dir()).basename();
			}
			return name;
		},
		// works for 
		// https://github.com/jupiterjs/funcunit/raw/master/dependencies.json
		installDependencies = function( depend_url, name ) {
			
			var depend_text, dependencies;
			
			try {
				depend_text = readUrl(depend_url);
			} catch (e) {}
			
			if (!depend_text ) {
				//steal.print("  No dependancies");
				return;
			}

			try {
				dependencies = JSONparse(depend_text);
			} catch (e) {
				steal.print("  No or mailformed dependencies");
				return;
			}

			for ( var plug_name in dependencies ) {
				if ( steal.prompt.yesno("Install dependency " + plug_name + "? (yN):") ) {
					steal.print("Installing " + plug_name + "...");
					steal.get(dependencies[plug_name], {
						name: plug_name
					});
				}
			}

			//steal.print("  Installed all dependencies for " + name);
		},
		runInstallScript = function( name ) {
			if ( readFile(name + "/install.js") ) {

				var res = steal.prompt.yesno("\n  " + name + " has an install script." + "\n    WARNING! Install scripts may be evil.  " + "\n    You can run it manually after reading the file by running:" + "\n      js " + name + "/install.js" + "\n\n  Would you like to run it now? (yN):");
				if ( res ) {
					steal.print("  running ...");
					load(name + "/install.js");
				}
			}
		};

		steal.extend(get,{
			pluginList: pluginList,
			pluginDependencies : function(url){
				//steal.print("  Checking plugin file ..."+url);
				var script, dependencies;
				
				try {
					script = readUrl(url);
				} catch (e) {
					steal.print("No plugin file");
					return;
				}
				if(/steal/.test(script)){
					try{
						var stealCalls = steal.dummy(script)
					} catch(e){
						//steal.print("Unable to figure out plugins.  Are you using steal in an unusual way?");
						//return;
					}
				}
				// get non-jquery plugins and see if they want to install ...
				var plugins = []
				for(var i = 0; i < stealCalls.plugins.length; i++){
					var plugin = stealCalls.plugins[i];
					if(!/^jquery\/|steal/.test(plugin) ){
						plugins.push(stealCalls.plugins[i])
					}
				}
				//create a temp steal to run this app ...
				
				
				
				
				if (!plugins.length ) {
					//steal.print("  No dependancies");
					return;
				}
				//print("length", plugins.length)
				return plugins;
			},
			installDependencies : function(dependencies){
				if(dependencies){
					//first we need to make sure the folder doesn't exist locally ...
					for(var i =0; i < dependencies.length; i++){
						get.installDependency(dependencies[i]);
					}
				}
				
			},
			installDependency : function(depend){
				if(installed[depend]){
					return;
				}
				if(steal.File(depend).exists()){
					installed[depend] = true;
					if ( steal.prompt.yesno("Update dependency " + depend + "? (yN):") ) {
						steal.print("Updating " + depend + "...");
						steal.get(depend, {
							name: depend
						});
					}
					
					return false;
				}else{
					
					if ( steal.prompt.yesno("Install dependency " + depend + "? (yN):") ) {
						installed[depend] = true;
						steal.print("Installing " + depend + "...");
						steal.get(depend, {
							name: depend
						});
					}
					
					return true;
				}
			}
		})
}, "//steal/get/getter", "//steal/get/github");