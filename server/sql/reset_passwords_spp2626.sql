-- Reset username + password semua akun ke format:
-- username: nama (tanpa spasi)
-- password: <username>@spp2626!
-- Dieksekusi langsung di database production/dev sesuai kebutuhan.

UPDATE users
SET
  username = CASE username
    WHEN 'staff1' THEN 'irvan'
    WHEN 'staff2' THEN 'eko'
    WHEN 'spv1' THEN 'ajat'
    WHEN 'teknisi1' THEN 'teknisia'
    WHEN 'teknisi2' THEN 'teknisib'
    WHEN 'mekanik1' THEN 'ahmadansorebashori'
    WHEN 'mekanik2' THEN 'bambangfachru'
    WHEN 'mekanik3' THEN 'muhdilutvi'
    ELSE username
  END,
  password_hash = CASE username
    WHEN 'staff1' THEN '$2b$10$Yzw52LG0GYX9RDdIOZ48peH2Aiba2i6vD247zs0yyS4g8MCvQ0MEu' -- irvann@spp2626!
    WHEN 'staff2' THEN '$2b$10$jYqNq0OZSnxWSzqfauqH0.gh/E0onVZx6axUjXTig4oT.cIFB73EK' -- eko@spp2626!
    WHEN 'spv1' THEN '$2b$10$GEpkaKN596590gl71YW5BOcJOvzjX/4/S/l06.P1kjlvrkkGv5oqu' -- ajat@spp2626!
    WHEN 'teknisi1' THEN '$2b$10$VXMAOuuZqycgQP5tQkbvZ.jRHAtUQqhp3szyCFjFGOwCL6c4Mp83K' -- teknisia@spp2626!
    WHEN 'teknisi2' THEN '$2b$10$j78brcL40oi5.aje/twlROexRbM0yz57d7lN/uKxjzIPBq8dPsXne' -- teknisib@spp2626!
    WHEN 'mekanik1' THEN '$2b$10$iQOzwAc59Z3ZrJosWGRoRuDIrGa5AOAEhJ4fMzCXfBg.xtsiEEIA.' -- ahmadansorebashori@spp2626!
    WHEN 'mekanik2' THEN '$2b$10$SsYZemUg3eX.qqzrw3etAe6fog4/Ws.hznJaY8GZ0XMGY0/kLi3Km' -- bambangfachru@spp2626!
    WHEN 'mekanik3' THEN '$2b$10$ysm/d1/Sb5fKdBbak4J9yuzMFIOEjlDCSnTv0mTPny7Xe5JbiUgvy' -- muhdilutvi@spp2626!
    ELSE password_hash
  END,
  updated_at = NOW()
WHERE username IN ('staff1', 'staff2', 'spv1', 'teknisi1', 'teknisi2', 'mekanik1', 'mekanik2', 'mekanik3');
