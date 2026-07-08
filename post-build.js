                                                                                                                
    import fs from 'fs';                                                                                           
    import path from 'path';                                                                                       
                                                                                                                   
    const serverCjsPath = path.join(process.cwd(), 'dist', 'server.cjs');                                          
                                                                                                                   
    if (!fs.existsSync(serverCjsPath)) {                                                                           
      console.error('server.cjs not found, skipping SMB2 patch.');                                                 
      process.exit(1);                                                                                             
    }                                                                                                              
                                                                                                                   
    console.log('Applying SMB2 patch to dist/server.cjs...');                                                      
    let c = fs.readFileSync(serverCjsPath, 'utf8');                                                                
                                                                                                                   
    c = c.replace(                                                                                                 
      'globRequire_messages("../messages/" + messageName)',                                                        
      'globRequire_messages("../messages/" + messageName + ".js")'                                                 
    );                                                                                                             
    c = c.replace(                                                                                                 
      'this.structure = globRequire_structures("../structures/" + this.headers["Command"].toLowerCase())',         
      'this.structure = globRequire_structures("../structures/" + this.headers["Command"].toLowerCase() + ".js")'  
    );                                                                                                             
    c = c.replace(                                                                                                 
      'message.structure = globRequire_structures("../structures/" + message.headers["Command"].toLowerCase())',   
      'message.structure = globRequire_structures("../structures/" + message.headers["Command"].toLowerCase() + ". 
  js")'
    );
  
    fs.writeFileSync(serverCjsPath, c);
    console.log('SMB2 patch applied successfully.');
  
